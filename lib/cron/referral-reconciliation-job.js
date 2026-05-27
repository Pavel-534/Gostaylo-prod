/**
 * Stage 119.2/119.3 — ежедневная ревизия: referral_ledger pending/earned при CANCELLED/REFUNDED брони.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { recordCriticalSignal } from '@/lib/critical-telemetry.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service.js'

const TERMINAL_BOOKING_STATUSES = ['CANCELLED', 'REFUNDED']
const OPEN_LEDGER_STATUSES = ['pending', 'earned']

function adminBookingHref(bookingId) {
  const base = (getPublicSiteUrl() || '').replace(/\/$/, '')
  const path = `/admin/bookings/${encodeURIComponent(String(bookingId))}`
  return base ? `${base}${path}` : path
}

/**
 * @param {string} bookingId
 * @param {Array<{ id: string, status: string, amount_thb: number, type: string }>} rows
 */
function buildMismatchEntry(bookingId, rows, bookingStatus) {
  const ledgerIds = rows.map((r) => String(r.id)).filter(Boolean)
  return {
    bookingId,
    bookingStatus: bookingStatus || null,
    ledgerRowCount: rows.length,
    ledgerIds: ledgerIds.slice(0, 12),
    openLedgerStatuses: [...new Set(rows.map((r) => String(r.status || '')))],
    adminHref: adminBookingHref(bookingId),
    adminPath: `/admin/bookings/${encodeURIComponent(String(bookingId))}`,
  }
}

/**
 * @param {{ dryRun?: boolean, limit?: number }} [options]
 */
export async function runReferralReconciliationJob(options = {}) {
  const dryRun = options.dryRun === true
  const limit = Math.min(500, Math.max(1, Number(options.limit) || 200))

  const { data: ledgerRows, error: ledgerErr } = await supabaseAdmin
    .from('referral_ledger')
    .select('id, booking_id, status, amount_thb, type, referral_type')
    .in('status', OPEN_LEDGER_STATUSES)
    .limit(5000)

  if (ledgerErr) {
    return { success: false, error: ledgerErr.message || 'LEDGER_READ_FAILED' }
  }

  const bookingIds = [
    ...new Set((ledgerRows || []).map((r) => String(r.booking_id || '')).filter(Boolean)),
  ]
  if (!bookingIds.length) {
    return {
      success: true,
      scannedLedgerRows: 0,
      mismatchBookingCount: 0,
      mismatchLedgerRows: 0,
      revertedBookingCount: 0,
      fixedByReconciliation: 0,
      dryRun,
      mismatches: [],
    }
  }

  const { data: bookings, error: bookErr } = await supabaseAdmin
    .from('bookings')
    .select('id, status')
    .in('id', bookingIds)
    .in('status', TERMINAL_BOOKING_STATUSES)
    .limit(5000)

  if (bookErr) {
    return { success: false, error: bookErr.message || 'BOOKINGS_READ_FAILED' }
  }

  const bookingStatusById = new Map((bookings || []).map((b) => [String(b.id), String(b.status || '')]))
  const terminalBookingIds = new Set(bookingStatusById.keys())
  const mismatchedRows = (ledgerRows || []).filter((r) => terminalBookingIds.has(String(r.booking_id)))
  const uniqueBookingIds = [...new Set(mismatchedRows.map((r) => String(r.booking_id)))].slice(0, limit)

  const rowsByBooking = new Map()
  for (const row of mismatchedRows) {
    const bid = String(row.booking_id)
    if (!rowsByBooking.has(bid)) rowsByBooking.set(bid, [])
    rowsByBooking.get(bid).push(row)
  }

  const mismatches = uniqueBookingIds.map((bookingId) =>
    buildMismatchEntry(bookingId, rowsByBooking.get(bookingId) || [], bookingStatusById.get(bookingId)),
  )

  const reverts = []
  for (const bookingId of uniqueBookingIds) {
    if (dryRun) {
      reverts.push({
        bookingId,
        dryRun: true,
        rowCount: (rowsByBooking.get(bookingId) || []).length,
      })
      continue
    }
    try {
      const revert = await ReferralPnlService.revertReferralLedgerForBooking(bookingId, {
        trigger: 'referral_reconciliation_cron',
      })
      reverts.push({ bookingId, revert })
    } catch (e) {
      reverts.push({ bookingId, error: e?.message || String(e) })
    }
  }

  const fixedByReconciliation = dryRun
    ? 0
    : reverts.filter((r) => {
        if (r.error || r.dryRun) return false
        const rev = r.revert
        if (rev?.success === false) return false
        const clawed = Number(rev?.clawback?.clawedBackCount || 0)
        const canceled = Number(rev?.pending?.canceledCount || 0)
        const promoApplied = Number(rev?.promoTank?.reversalCount || 0)
        return clawed > 0 || canceled > 0 || promoApplied > 0
      }).length

  if (uniqueBookingIds.length > 0) {
    const sampleLines = mismatches.slice(0, 6).flatMap((m) => [
      `booking=${m.bookingId} status=${m.bookingStatus} ledgerRows=${m.ledgerRowCount}`,
      `admin: ${m.adminHref}`,
      `ledgerIds: ${(m.ledgerIds || []).slice(0, 4).join(', ')}`,
    ])
    recordCriticalSignal('REFERRAL_RECONCILIATION_MISMATCH', {
      threshold: 1,
      windowMs: 60_000,
      tag: '[REFERRAL_RECONCILE]',
      detailLines: [
        `mismatchBookings: ${uniqueBookingIds.length}`,
        `mismatchLedgerRows: ${mismatchedRows.length}`,
        `fixedByReconciliation: ${fixedByReconciliation}`,
        `dryRun: ${dryRun}`,
        ...sampleLines,
      ],
      persistDetail: {
        mismatchBookingCount: uniqueBookingIds.length,
        mismatchLedgerRows: mismatchedRows.length,
        mismatches: mismatches.slice(0, 20),
      },
    })
  }

  return {
    success: true,
    dryRun,
    scannedLedgerRows: (ledgerRows || []).length,
    mismatchLedgerRows: mismatchedRows.length,
    mismatchBookingCount: uniqueBookingIds.length,
    revertedBookingCount: dryRun ? 0 : reverts.filter((r) => r.revert?.success !== false && !r.error).length,
    fixedByReconciliation,
    failures: reverts.filter((r) => r.error || r.revert?.success === false),
    mismatches: mismatches.slice(0, 30),
    reverts: reverts.slice(0, 20),
  }
}

/**
 * Сумма fixed за последние 24ч из ops_job_runs (для daily report).
 */
export async function sumReferralReconciliationFixedLast24h() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabaseAdmin
    .from('ops_job_runs')
    .select('stats, started_at')
    .eq('job_name', 'referral-reconciliation')
    .eq('status', 'success')
    .gte('started_at', since)
    .limit(200)

  if (error) return { fixed24h: 0, runCount24h: 0, error: error.message }

  let fixed24h = 0
  for (const row of data || []) {
    const s = row?.stats && typeof row.stats === 'object' ? row.stats : {}
    fixed24h += Number(s.fixedByReconciliation ?? s.revertedBookingCount ?? 0)
  }
  return { fixed24h, runCount24h: (data || []).length, since }
}

export default { runReferralReconciliationJob, sumReferralReconciliationFixedLast24h }
