/**
 * Stage 211.2 — partner period statement pack (earned vs paid vs closing acts).
 * Does NOT recompute escrow / getPartnerBalance. Booking money = read-model SSOT.
 */

import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { buildBookingFinancialSnapshotFromRow } from '@/lib/services/booking-financial-read-model.service.js'
import { loadPartnerFinancesExportBookings } from '@/lib/services/partner-finances-export.service.js'
import { listPartnerSettlementDocuments } from '@/lib/services/partner-settlement-documents.service.js'
import {
  filterSettlementDocumentsByPeriod,
  sumPeriodSnapshotTotals,
  sumSettledPayoutsInPeriod,
  utcPeriodBounds,
} from '@/lib/services/partner-finances-period-math.js'

function emptyPack(fromYmd, toYmd, axis) {
  return {
    fromYmd,
    toYmd,
    axis,
    bookingCount: 0,
    totalGrossThb: 0,
    totalCommissionThb: 0,
    totalNetEarnedThb: 0,
    totalPaidOutThb: 0,
    payoutCount: 0,
    linkedSettlementDocs: [],
  }
}

/**
 * @param {{
 *   partnerId: string,
 *   fromYmd: string,
 *   toYmd: string,
 *   axis?: 'created'|'checkout',
 *   bookingRows?: object[],
 * }} opts
 */
export async function computePartnerFinancesPeriodPack(opts) {
  const partnerId = String(opts?.partnerId || '').trim()
  const fromYmd = String(opts?.fromYmd || '').trim()
  const toYmd = String(opts?.toYmd || '').trim()
  const axis = opts?.axis === 'checkout' ? 'checkout' : 'created'
  if (!partnerId || !fromYmd || !toYmd) {
    return { success: false, error: 'INVALID_PERIOD', data: emptyPack(fromYmd, toYmd, axis) }
  }

  let bookingRows = Array.isArray(opts.bookingRows) ? opts.bookingRows : null
  if (!bookingRows) {
    const loaded = await loadPartnerFinancesExportBookings({ partnerId, fromYmd, toYmd, axis })
    if (!loaded.success) {
      return { success: false, error: loaded.error, data: emptyPack(fromYmd, toYmd, axis) }
    }
    bookingRows = loaded.rows
  }

  const snaps = (bookingRows || []).map((row) => buildBookingFinancialSnapshotFromRow(row)).filter(Boolean)
  const bookingTotals = sumPeriodSnapshotTotals(snaps)
  const { fromIso, toIso } = utcPeriodBounds(fromYmd, toYmd)

  let payoutRows = []
  if (isSupabaseConfigured() && supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('payouts')
      .select('id, status, gross_amount, final_amount, amount, created_at, processed_at')
      .eq('partner_id', partnerId)
      .in('status', ['PAID', 'COMPLETED'])
      .limit(2000)
    if (error) {
      return { success: false, error: error.message || 'PAYOUTS_READ_FAILED', data: emptyPack(fromYmd, toYmd, axis) }
    }
    payoutRows = data || []
  }

  const paid = sumSettledPayoutsInPeriod(payoutRows, fromIso, toIso)
  const docsResult = await listPartnerSettlementDocuments(partnerId)
  const linkedSettlementDocs = docsResult.success
    ? filterSettlementDocumentsByPeriod(docsResult.rows, fromIso, toIso)
    : []

  return {
    success: true,
    data: {
      fromYmd,
      toYmd,
      axis,
      ...bookingTotals,
      totalPaidOutThb: paid.totalPaidOutThb,
      payoutCount: paid.payoutCount,
      linkedSettlementDocs,
    },
  }
}
