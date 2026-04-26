/**
 * Stage 59.0–60.0 — drain `notification_outbox` (cron / admin / system route).
 * Stage 60.0: reclaim stale `processing` → `pending` (does not reset `attempts`).
 * Uses same handler deps as `NotificationService.dispatch` (email / Telegram).
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveNotificationHandler } from '@/lib/services/notifications/notification-registry.js'
import { wireNotificationHandlerDeps } from '@/lib/services/notification.service.js'
import { runWithCorrelationId } from '@/lib/request-correlation.js'
import { logStructured, recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js'

const MAX_BATCH = 20
const MAX_ATTEMPTS = 5
const BACKOFF_MINUTES_PER_ATTEMPT = 5
/** Rows stuck in `processing` longer than this are returned to `pending` (Stage 60.0). */
const STALE_PROCESSING_MS = 30 * 60 * 1000

function truncateErr(e) {
  const s = e?.stack || e?.message || String(e)
  return s.length > 2000 ? s.slice(0, 2000) : s
}

function eligibleForPickup(row, nowMs) {
  if (!row || row.attempts >= MAX_ATTEMPTS) return false
  const st = String(row.status || '')
  if (st !== 'pending' && st !== 'failed') return false
  if (row.next_attempt_at == null || row.next_attempt_at === '') return true
  const t = new Date(row.next_attempt_at).getTime()
  return Number.isFinite(t) && t <= nowMs
}

/**
 * Stale `processing` → `pending` so a crashed worker does not block the row forever.
 * Does not modify `attempts`, `last_error`, or `next_attempt_at`.
 * @returns {Promise<number>} number of rows reclaimed
 */
async function reclaimStaleProcessingOutbox() {
  const cutoffIso = new Date(Date.now() - STALE_PROCESSING_MS).toISOString()
  const { data, error } = await supabaseAdmin
    .from('notification_outbox')
    .update({ status: 'pending' })
    .eq('status', 'processing')
    .lt('updated_at', cutoffIso)
    .select('id')

  if (error) {
    logStructured({
      module: 'NotificationOutboxWorker',
      stage: 'reclaim_error',
      error: error.message,
    })
    return 0
  }
  return Array.isArray(data) ? data.length : 0
}

/**
 * @param {{ limit?: number }} [opts]
 * @returns {Promise<{ scanned: number, claimed: number, sent: number, failed: number, permanentFailure: number, skipped: number, reclaimed: number }>}
 */
export async function runNotificationOutboxWorker(opts = {}) {
  const limit = Math.min(Math.max(1, Number(opts.limit) || MAX_BATCH), 50)
  if (!supabaseAdmin?.from) {
    return {
      scanned: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
      permanentFailure: 0,
      skipped: 0,
      reclaimed: 0,
      error: 'supabase_admin_missing',
    }
  }

  const nowMs = Date.now()
  const reclaimed = await reclaimStaleProcessingOutbox()
  if (reclaimed > 0) {
    logStructured({
      module: 'NotificationOutboxWorker',
      stage: 'reclaim_done',
      reclaimed,
    })
  }

  const { data: batch, error: fetchError } = await supabaseAdmin
    .from('notification_outbox')
    .select('id,event,payload,attempts,status,correlation_id,next_attempt_at,created_at')
    .in('status', ['pending', 'failed'])
    .lt('attempts', MAX_ATTEMPTS)
    .order('created_at', { ascending: true })
    .limit(80)

  if (fetchError) {
    logStructured({
      module: 'NotificationOutboxWorker',
      stage: 'fetch_error',
      error: fetchError.message,
    })
    return {
      scanned: 0,
      claimed: 0,
      sent: 0,
      failed: 0,
      permanentFailure: 0,
      skipped: 0,
      reclaimed,
      error: fetchError.message,
    }
  }

  const rows = Array.isArray(batch) ? batch : []
  const eligible = rows.filter((r) => eligibleForPickup(r, nowMs)).slice(0, limit)

  let claimed = 0
  let sent = 0
  let failed = 0
  let permanentFailure = 0
  let skipped = 0

  for (const row of eligible) {
    const { data: locked, error: lockError } = await supabaseAdmin
      .from('notification_outbox')
      .update({ status: 'processing' })
      .eq('id', row.id)
      .in('status', ['pending', 'failed'])
      .lt('attempts', MAX_ATTEMPTS)
      .select('id,event,payload,attempts,status,correlation_id,next_attempt_at')
      .maybeSingle()

    if (lockError || !locked) {
      skipped += 1
      continue
    }
    claimed += 1

    const handler = resolveNotificationHandler(locked.event)
    if (!handler) {
      const newAttempts = Number(locked.attempts) + 1
      const errText = `no_handler_for_event:${String(locked.event)}`
      if (newAttempts >= MAX_ATTEMPTS) {
        await supabaseAdmin
          .from('notification_outbox')
          .update({
            status: 'permanent_failure',
            attempts: newAttempts,
            last_error: errText,
            next_attempt_at: null,
          })
          .eq('id', locked.id)
        permanentFailure += 1
        await signalPermanentFailure(locked, errText, locked.correlation_id)
      } else {
        const nextAt = new Date(nowMs + BACKOFF_MINUTES_PER_ATTEMPT * 60 * 1000 * newAttempts).toISOString()
        await supabaseAdmin
          .from('notification_outbox')
          .update({
            status: 'failed',
            attempts: newAttempts,
            last_error: errText,
            next_attempt_at: nextAt,
          })
          .eq('id', locked.id)
        failed += 1
      }
      continue
    }

    const cid = String(locked.correlation_id || '').trim() || randomUUID()
    try {
      await runWithCorrelationId(cid, async () => {
        wireNotificationHandlerDeps()
        await handler(locked.payload)
      })
      const newAttempts = Number(locked.attempts) + 1
      await supabaseAdmin
        .from('notification_outbox')
        .update({
          status: 'sent',
          attempts: newAttempts,
          last_error: null,
          next_attempt_at: null,
        })
        .eq('id', locked.id)
      sent += 1
      logStructured({
        module: 'NotificationOutboxWorker',
        stage: 'sent',
        outboxId: locked.id,
        event: locked.event,
        correlationId: cid,
        attempts: newAttempts,
      })
    } catch (e) {
      const errText = truncateErr(e)
      const newAttempts = Number(locked.attempts) + 1
      if (newAttempts >= MAX_ATTEMPTS) {
        await supabaseAdmin
          .from('notification_outbox')
          .update({
            status: 'permanent_failure',
            attempts: newAttempts,
            last_error: errText,
            next_attempt_at: null,
          })
          .eq('id', locked.id)
        permanentFailure += 1
        await signalPermanentFailure(locked, errText, cid)
      } else {
        const nextAt = new Date(nowMs + BACKOFF_MINUTES_PER_ATTEMPT * 60 * 1000 * newAttempts).toISOString()
        await supabaseAdmin
          .from('notification_outbox')
          .update({
            status: 'failed',
            attempts: newAttempts,
            last_error: errText,
            next_attempt_at: nextAt,
          })
          .eq('id', locked.id)
        failed += 1
      }
      logStructured({
        module: 'NotificationOutboxWorker',
        stage: newAttempts >= MAX_ATTEMPTS ? 'permanent_failure' : 'failed_retry',
        outboxId: locked.id,
        event: locked.event,
        correlationId: cid,
        attempts: newAttempts,
        errorPreview: errText.slice(0, 240),
      })
    }
  }

  return {
    scanned: rows.length,
    claimed,
    sent,
    failed,
    permanentFailure,
    skipped,
    reclaimed,
  }
}

/**
 * @param {{ id: string, event: string, payload?: unknown }} row
 * @param {string} errText
 * @param {string} [correlationId]
 */
async function signalPermanentFailure(row, errText, correlationId = null) {
  const safeEvent = escapeSystemAlertHtml(String(row?.event || ''))
  const safeId = escapeSystemAlertHtml(String(row?.id || ''))
  const safeErr = escapeSystemAlertHtml(String(errText || '').slice(0, 500))
  void notifySystemAlert(
    `[OPS] <b>Notification outbox permanent_failure</b>\n` +
      `id: <code>${safeId}</code>\n` +
      `event: <code>${safeEvent}</code>\n` +
      `<pre>${safeErr}</pre>`,
  )
  recordCriticalSignal('NOTIFICATION_OUTBOX_PERMANENT_FAILURE', {
    tag: '[OPS]',
    threshold: 1,
    windowMs: 60_000,
    correlationId: correlationId || undefined,
    detailLines: [
      `outboxId=${row?.id}`,
      `event=${row?.event}`,
      `error=${String(errText || '').slice(0, 400)}`,
    ],
  })
}
