/**
 * Stage 142 — Telegram & FCM channel metrics for /admin/health (24h window).
 */
import { supabaseAdmin } from '@/lib/supabase'

const TELEGRAM_WARNING_FAIL_PCT = 15
const TELEGRAM_CRITICAL_FAIL_PCT = 30

const OUTBOX_MISSING = "Could not find the table 'public.notification_outbox'"
const CRITICAL_MISSING = "Could not find the table 'public.critical_signal_events'"

/**
 * @param {ReturnType<import('./ops-job-health.js').sanitizeOpsJobRow>[]} opsRows
 * @param {string} since24hIso
 */
function aggregateSlaTelegram24h(opsRows, since24hIso) {
  const sinceMs = new Date(since24hIso).getTime()
  let sent = 0
  let errors = 0
  let skipped = 0
  let runCount = 0

  for (const row of opsRows || []) {
    if (row?.job_name !== 'partner-sla-telegram-nudge') continue
    const t = new Date(row.started_at || 0).getTime()
    if (!Number.isFinite(t) || t < sinceMs) continue
    runCount += 1
    const s = row.stats && typeof row.stats === 'object' ? row.stats : {}
    sent += Number(s.sent || 0)
    errors += Number(s.errors || 0)
    skipped += Number(s.skipped || 0)
  }

  const attempted = sent + errors
  const failPct =
    attempted > 0 ? Math.round((errors / attempted) * 1000) / 10 : null
  const successPct =
    attempted > 0 ? Math.round((sent / attempted) * 1000) / 10 : null

  let severity = null
  if (failPct != null && failPct > TELEGRAM_WARNING_FAIL_PCT) {
    severity = failPct > TELEGRAM_CRITICAL_FAIL_PCT ? 'critical' : 'warning'
  }

  return {
    source: 'partner-sla-telegram-nudge',
    runCount,
    sent,
    errors,
    skipped,
    attempted,
    successPercent: successPct,
    failPercent: failPct,
    severity,
  }
}

/**
 * @param {ReturnType<import('./ops-job-health.js').sanitizeOpsJobRow>[]} opsRows
 * @param {string} since24hIso
 */
function aggregateFcmHygiene24h(opsRows, since24hIso) {
  const sinceMs = new Date(since24hIso).getTime()
  let removed = 0
  let probed = 0
  let runCount = 0

  for (const row of opsRows || []) {
    if (row?.job_name !== 'push-token-hygiene') continue
    const t = new Date(row.started_at || 0).getTime()
    if (!Number.isFinite(t) || t < sinceMs) continue
    runCount += 1
    const s = row.stats && typeof row.stats === 'object' ? row.stats : {}
    removed += Number(s.removed || 0)
    probed += Number(s.probed || 0)
  }

  return { runCount, removed, probed }
}

/**
 * @param {string} since24hIso
 */
async function countFcmCleanedSignals24h(since24hIso) {
  if (!supabaseAdmin?.from) {
    return { count: 0, error: 'supabase_admin_missing' }
  }
  const { count, error } = await supabaseAdmin
    .from('critical_signal_events')
    .select('id', { count: 'exact', head: true })
    .eq('signal_key', 'FCM_TOKEN_CLEANED')
    .gte('created_at', since24hIso)

  if (error) {
    if (String(error.message || '').includes(CRITICAL_MISSING)) {
      return { count: 0, tablePresent: false, error: null }
    }
    return { count: 0, error: error.message }
  }
  return { count: Number(count || 0), tablePresent: true, error: null }
}

/**
 * Outbox terminal rows (email + Telegram handlers); supplementary to SLA cron metric.
 * @param {string} since24hIso
 */
async function loadOutboxTerminal24h(since24hIso) {
  if (!supabaseAdmin?.from) {
    return { sent: 0, failed: 0, permanentFailure: 0, error: 'supabase_admin_missing' }
  }
  const statuses = ['sent', 'failed', 'permanent_failure']
  const results = await Promise.all(
    statuses.map(async (status) => {
      const { count, error } = await supabaseAdmin
        .from('notification_outbox')
        .select('id', { count: 'exact', head: true })
        .eq('status', status)
        .gte('updated_at', since24hIso)
      return { status, count: typeof count === 'number' ? count : 0, error: error?.message }
    }),
  )

  const firstErr = results.find((r) => r.error)?.error
  if (firstErr && String(firstErr).includes(OUTBOX_MISSING)) {
    return { sent: 0, failed: 0, permanentFailure: 0, tablePresent: false, error: null }
  }
  if (firstErr) {
    return { sent: 0, failed: 0, permanentFailure: 0, error: firstErr }
  }

  const sent = results.find((r) => r.status === 'sent')?.count ?? 0
  const failed = results.find((r) => r.status === 'failed')?.count ?? 0
  const permanentFailure = results.find((r) => r.status === 'permanent_failure')?.count ?? 0
  const attempted = sent + failed + permanentFailure
  const failCount = failed + permanentFailure
  const failPct = attempted > 0 ? Math.round((failCount / attempted) * 1000) / 10 : null
  const successPct = attempted > 0 ? Math.round((sent / attempted) * 1000) / 10 : null

  let severity = null
  if (failPct != null && failPct > TELEGRAM_WARNING_FAIL_PCT) {
    severity = failPct > TELEGRAM_CRITICAL_FAIL_PCT ? 'critical' : 'warning'
  }

  return {
    sent,
    failed,
    permanentFailure,
    attempted,
    successPercent: successPct,
    failPercent: failPct,
    severity,
    tablePresent: true,
    error: null,
    note: 'notification_outbox — все каналы (email + Telegram), когда NOTIFICATION_OUTBOX=1',
  }
}

/**
 * @param {{
 *   opsRows: ReturnType<import('./ops-job-health.js').sanitizeOpsJobRow>[],
 *   since24hIso: string,
 * }} args
 */
export async function loadNotificationChannelHealth({ opsRows, since24hIso }) {
  const telegramSla = aggregateSlaTelegram24h(opsRows, since24hIso)
  const fcmHygiene = aggregateFcmHygiene24h(opsRows, since24hIso)
  const [fcmSignals, outbox] = await Promise.all([
    countFcmCleanedSignals24h(since24hIso),
    loadOutboxTerminal24h(since24hIso),
  ])

  const fcmRemovedTotal = fcmHygiene.removed + Number(fcmSignals.count || 0)

  /** Headline Telegram severity — SLA cron is SSOT for TG delivery attempts. */
  let telegramSeverity = telegramSla.severity
  if (!telegramSeverity && outbox.severity && (outbox.attempted || 0) >= 10) {
    telegramSeverity = outbox.severity
  }

  return {
    windowHours: 24,
    since: since24hIso,
    telegram: {
      slaNudge: telegramSla,
      outbox,
      headline: {
        successPercent: telegramSla.successPercent ?? outbox.successPercent,
        failPercent: telegramSla.failPercent ?? outbox.failPercent,
        severity: telegramSeverity,
        primarySource:
          (telegramSla.attempted || 0) > 0 ? 'partner-sla-telegram-nudge' : 'notification_outbox',
      },
    },
    fcm: {
      hygieneRuns24h: fcmHygiene.runCount,
      tokensRemovedByHygieneCron: fcmHygiene.removed,
      tokensProbedByHygieneCron: fcmHygiene.probed,
      cleanedSignals24h: fcmSignals.count,
      cleanedSignalsError: fcmSignals.error,
      tokensRemovedTotal: fcmRemovedTotal,
    },
  }
}
