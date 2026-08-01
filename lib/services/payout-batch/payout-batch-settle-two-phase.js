/**
 * AUDIT_MONEY_FLOW_04 — two-phase batch settle (ledger then booking COMPLETED).
 * No public FSM change: progress flag lives on payout_batch_items.metadata (+ booking.metadata).
 *
 * Phases:
 *  1) stamp settling_at (item stays PENDING)
 *  2) ledger post (idempotent payout_batch_settled:{batch}:{booking})
 *  3) item SETTLED + booking → COMPLETED via transitionBookingStatus
 *
 * Repair: ledger exists ∧ booking not COMPLETED → catch-up status only.
 * Stuck: settling_at > 10m ∧ no ledger → SETTLE_STUCK (no blind re-post).
 */

import { supabaseAdmin } from '@/lib/supabase'
import LedgerService from '@/lib/services/ledger.service.js'
import { BookingStatus } from '@/lib/services/escrow/constants.js'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { round2 } from '@/lib/services/payout-batch/payout-batch-shared.js'

export const SETTLING_STUCK_MS = 10 * 60 * 1000
export const SETTLE_ORPHAN_MIN_AGE_MS = 5 * 60 * 1000

export function batchSettleIdempotencyKey(batchId, bookingId) {
  return `payout_batch_settled:${String(batchId || '')}:${String(bookingId || '')}`
}

/**
 * @param {string} batchId
 * @param {string} bookingId
 * @returns {Promise<{ id: string, created_at?: string } | null>}
 */
export async function findBatchSettleJournal(batchId, bookingId) {
  if (!supabaseAdmin) return null
  const key = batchSettleIdempotencyKey(batchId, bookingId)
  const { data, error } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, created_at, booking_id, event_type')
    .eq('idempotency_key', key)
    .maybeSingle()
  if (error) {
    console.warn('[batch-settle-two-phase] journal lookup', error.message)
    return null
  }
  return data?.id ? data : null
}

function itemMeta(item) {
  return item?.metadata && typeof item.metadata === 'object' ? { ...item.metadata } : {}
}

function bookingMeta(booking) {
  return booking?.metadata && typeof booking.metadata === 'object' ? { ...booking.metadata } : {}
}

function settlingStartedAtMs(meta) {
  const raw = meta?.settling_at || meta?.settle_phase_started_at
  if (!raw) return null
  const ms = Date.parse(String(raw))
  return Number.isFinite(ms) ? ms : null
}

function alertSettleStuck({ batchId, bookingId, itemId, settlingAt, ageMs }) {
  recordCriticalSignal('SETTLE_STUCK', {
    severity: 'CRITICAL',
    tag: '[FINANCE]',
    threshold: 1,
    windowMs: 60 * 60 * 1000,
    detailLines: [
      `[SETTLE_STUCK] batch item settling_in_progress without ledger >10m — manual review`,
      `batchId=${batchId || 'unknown'}`,
      `bookingId=${bookingId || 'unknown'}`,
      `itemId=${itemId || 'unknown'}`,
      `settling_at=${settlingAt || 'unknown'}`,
      `ageMs=${ageMs ?? 'unknown'}`,
    ],
  })
}

function alertSettleOrphan({ bookingId, ledgerId, status, batchId }) {
  recordCriticalSignal('SETTLE_ORPHAN', {
    severity: 'CRITICAL',
    tag: '[FINANCE]',
    threshold: 1,
    windowMs: 60 * 60 * 1000,
    detailLines: [
      `[SETTLE_ORPHAN] booking ${bookingId || 'unknown'} has ledger settle but status=${status || 'unknown'}. Manual review required.`,
      `ledgerId=${ledgerId || 'unknown'}`,
      `batchId=${batchId || 'unknown'}`,
    ],
  })
}

/**
 * Stamp phase-1 progress on batch item (+ booking metadata) without changing public booking FSM.
 * Item status stays PENDING until ledger succeeds (CHECK constraint: no SETTLING_IN_PROGRESS).
 *
 * @param {object} item
 * @param {object | null} bookingRow
 * @param {string} batchId
 * @param {string} nowIso
 */
export async function stampSettlingInProgress(item, bookingRow, batchId, nowIso) {
  const meta = itemMeta(item)
  if (!meta.settling_at) {
    meta.settling_at = nowIso
    meta.settle_phase = 'in_progress'
    meta.settle_batch_id = batchId
    await supabaseAdmin
      .from('payout_batch_items')
      .update({ metadata: meta, updated_at: nowIso })
      .eq('id', item.id)
    item.metadata = meta
  }

  if (bookingRow?.id) {
    const bMeta = bookingMeta(bookingRow)
    if (!bMeta.settling_at) {
      bMeta.settling_at = meta.settling_at || nowIso
      bMeta.settle_batch_id = batchId
      bMeta.settle_phase = 'in_progress'
      await supabaseAdmin
        .from('bookings')
        .update({ metadata: bMeta, updated_at: nowIso })
        .eq('id', bookingRow.id)
      bookingRow.metadata = bMeta
    }
  }

  return meta
}

/**
 * Booking → COMPLETED after ledger settle (system FSM READY/THAWED → COMPLETED).
 *
 * @returns {Promise<{ completed: boolean, skipped?: boolean, error?: string }>}
 */
export async function catchUpBookingCompletedAfterSettle({
  bookingId,
  bookingRow,
  batchId,
  settledBy,
  nowIso,
  journalId = null,
}) {
  const st = String(bookingRow?.status || '').toUpperCase()
  if (st === BookingStatus.COMPLETED || st === 'COMPLETED') {
    return { completed: false, skipped: true, reason: 'already_completed' }
  }

  if (!['READY_FOR_PAYOUT', 'THAWED'].includes(st)) {
    // Orphan detector covers non-completable statuses with ledger present.
    return { completed: false, skipped: true, reason: `status_${st || 'unknown'}` }
  }

  const meta = bookingMeta(bookingRow)
  delete meta.settle_phase
  const statusRes = await transitionBookingStatus(bookingId, BookingStatus.COMPLETED, {
    scope: 'system',
    actorContext: { trigger: 'payout_batch_settled' },
    metadata: { completedAt: nowIso, updatedAt: nowIso },
    extraPatch: {
      payout_at: nowIso,
      metadata: {
        ...meta,
        payout_batch_id: batchId,
        payout_batch_settled_at: nowIso,
        payout_batch_settled_by: settledBy || null,
        settle_ledger_journal_id: journalId || meta.settle_ledger_journal_id || null,
        settle_phase: 'completed',
        settling_at: meta.settling_at || nowIso,
      },
    },
  })

  if (!statusRes.success) {
    return { completed: false, error: statusRes.error || 'COMPLETED_transition_failed' }
  }
  return { completed: true }
}

/**
 * Mark item SETTLED after successful ledger (or ledger already present).
 */
export async function markBatchItemSettled(item, nowIso, extraMeta = {}) {
  const meta = {
    ...itemMeta(item),
    ...extraMeta,
    settle_phase: 'settled',
    ledger_posted_at: extraMeta.ledger_posted_at || nowIso,
    ledger_error: null,
  }
  await supabaseAdmin
    .from('payout_batch_items')
    .update({
      status: 'SETTLED',
      updated_at: nowIso,
      metadata: meta,
    })
    .eq('id', item.id)
  item.status = 'SETTLED'
  item.metadata = meta
}

/**
 * One batch item: two-phase settle with ledger-first idempotency.
 *
 * @returns {Promise<{
 *   outcome: 'settled' | 'catch_up' | 'skipped_settled' | 'stuck' | 'ledger_error' | 'completed_fail',
 *   ledgerPosted?: boolean,
 *   bookingCompleted?: boolean,
 *   error?: string,
 * }>}
 */
export async function settleBatchItemTwoPhase({
  item,
  bookingRow,
  batchId,
  settledBy,
  nowIso,
}) {
  const bookingId = String(item.booking_id || '')
  const partnerId = item.partner_id
  const amountThb = round2(item.amount_thb)
  const itemStatus = String(item.status || '').toUpperCase()

  // --- Already SETTLED: catch up COMPLETED if needed ---
  if (itemStatus === 'SETTLED') {
    const journal = await findBatchSettleJournal(batchId, bookingId)
    const catchUp = await catchUpBookingCompletedAfterSettle({
      bookingId,
      bookingRow,
      batchId,
      settledBy,
      nowIso,
      journalId: journal?.id || null,
    })
    return {
      outcome: catchUp.completed ? 'catch_up' : 'skipped_settled',
      ledgerPosted: true,
      bookingCompleted: Boolean(catchUp.completed),
      error: catchUp.error,
    }
  }

  // --- Ledger already exists (crash between ledger and COMPLETED / item SETTLED) ---
  const existingJournal = await findBatchSettleJournal(batchId, bookingId)
  if (existingJournal?.id) {
    await markBatchItemSettled(item, nowIso, {
      ledger_posted_at: existingJournal.created_at || nowIso,
      settle_ledger_journal_id: existingJournal.id,
      settle_repaired_at: nowIso,
    })
    const catchUp = await catchUpBookingCompletedAfterSettle({
      bookingId,
      bookingRow,
      batchId,
      settledBy,
      nowIso,
      journalId: existingJournal.id,
    })
    return {
      outcome: catchUp.completed ? 'catch_up' : 'settled',
      ledgerPosted: true,
      bookingCompleted: Boolean(catchUp.completed),
      error: catchUp.error,
    }
  }

  // --- Stuck: settling stamped, no ledger, age > 10m ---
  const meta = itemMeta(item)
  const startedMs = settlingStartedAtMs(meta) ?? settlingStartedAtMs(bookingMeta(bookingRow))
  if (startedMs != null && Date.now() - startedMs > SETTLING_STUCK_MS) {
    alertSettleStuck({
      batchId,
      bookingId,
      itemId: item.id,
      settlingAt: new Date(startedMs).toISOString(),
      ageMs: Date.now() - startedMs,
    })
    return { outcome: 'stuck', ledgerPosted: false, bookingCompleted: false }
  }

  // --- Phase 1: stamp settling_at ---
  await stampSettlingInProgress(item, bookingRow, batchId, nowIso)

  // --- Phase 2: ledger ---
  const ledger = await LedgerService.postPartnerBatchBookingPayoutSettled({
    batchId,
    bookingId,
    partnerId,
    amountThb,
  })

  if (!ledger.success && !ledger.skipped) {
    await supabaseAdmin
      .from('payout_batch_items')
      .update({
        updated_at: nowIso,
        metadata: {
          ...itemMeta(item),
          ledger_error: String(ledger.error || 'ledger_failed').slice(0, 500),
          ledger_error_at: nowIso,
        },
      })
      .eq('id', item.id)
    return {
      outcome: 'ledger_error',
      ledgerPosted: false,
      bookingCompleted: false,
      error: ledger.error || 'ledger_failed',
    }
  }

  const journalId =
    ledger.journalId ||
    (await findBatchSettleJournal(batchId, bookingId))?.id ||
    null

  await markBatchItemSettled(item, nowIso, {
    settle_ledger_journal_id: journalId,
  })

  // --- Phase 3: COMPLETED ---
  const catchUp = await catchUpBookingCompletedAfterSettle({
    bookingId,
    bookingRow: {
      ...bookingRow,
      status: bookingRow?.status,
      metadata: {
        ...bookingMeta(bookingRow),
        settling_at: itemMeta(item).settling_at || nowIso,
      },
    },
    batchId,
    settledBy,
    nowIso,
    journalId,
  })

  if (catchUp.error) {
    return {
      outcome: 'completed_fail',
      ledgerPosted: true,
      bookingCompleted: false,
      error: catchUp.error,
    }
  }

  return {
    outcome: 'settled',
    ledgerPosted: true,
    bookingCompleted: Boolean(catchUp.completed),
  }
}

/**
 * Health scan: ledger batch-settle journals older than 5m whose booking is not COMPLETED.
 *
 * @param {{ limit?: number, minAgeMs?: number }} [opts]
 */
export async function detectSettleOrphans(opts = {}) {
  if (!supabaseAdmin) {
    return { orphans: [], scanned: 0, error: 'no_db' }
  }

  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 300)
  const minAgeMs = Number.isFinite(opts.minAgeMs) ? opts.minAgeMs : SETTLE_ORPHAN_MIN_AGE_MS
  const olderThan = new Date(Date.now() - minAgeMs).toISOString()

  const { data: journals, error } = await supabaseAdmin
    .from('ledger_journals')
    .select('id, booking_id, idempotency_key, created_at, metadata')
    .eq('event_type', 'PARTNER_PAYOUT_OBLIGATION_SETTLED')
    .like('idempotency_key', 'payout_batch_settled:%')
    .lt('created_at', olderThan)
    .not('booking_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    return { orphans: [], scanned: 0, error: error.message }
  }

  const rows = journals || []
  if (!rows.length) return { orphans: [], scanned: 0 }

  const bookingIds = [...new Set(rows.map((j) => j.booking_id).filter(Boolean))]
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .in('id', bookingIds)

  const statusById = new Map((bookings || []).map((b) => [b.id, String(b.status || '').toUpperCase()]))
  const orphans = []

  for (const j of rows) {
    const st = statusById.get(j.booking_id) || 'MISSING'
    if (st === 'COMPLETED') continue
    const batchId =
      j.metadata?.payout_batch_id ||
      String(j.idempotency_key || '').replace(/^payout_batch_settled:/, '').split(':')[0] ||
      null
    orphans.push({
      bookingId: j.booking_id,
      ledgerId: j.id,
      status: st,
      batchId,
      createdAt: j.created_at,
    })
    alertSettleOrphan({
      bookingId: j.booking_id,
      ledgerId: j.id,
      status: st,
      batchId,
    })
  }

  return { orphans, scanned: rows.length }
}
