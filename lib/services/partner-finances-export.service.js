/**
 * Partner finances statement export (Stage 211.1).
 * CSV/PDF rows use booking-financial-read-model SSOT — do not recompute fee/net here.
 *
 * Date axis:
 * - created → bookings.created_at
 * - checkout → bookings.check_out (schema SSOT; there is no end_date column)
 */

import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { buildBookingFinancialSnapshotFromRow } from '@/lib/services/booking-financial-read-model.service'
import {
  PARTNER_FINANCES_EXPORT_MAX_ROWS,
  isoDateOnly,
  joinPartnerFinancesCsv,
  listingTitleFromRow,
  partnerFinancesExportAxisColumn,
} from '@/lib/services/partner-finances-export-format.js'

export {
  PARTNER_FINANCES_EXPORT_MAX_RANGE_DAYS,
  PARTNER_FINANCES_EXPORT_MAX_ROWS,
  PARTNER_FINANCES_CSV_HEADERS,
  resolvePartnerFinancesExportAxis,
  partnerFinancesExportAxisColumn,
  parsePartnerFinancesExportYmd,
  parsePartnerFinancesExportParams,
  buildPartnerFinancesExportFilename,
  csvEscapeCell,
} from '@/lib/services/partner-finances-export-format.js'

const BOOKING_SELECT = `
  id,status,created_at,check_in,check_out,currency,listing_currency,price_thb,price_paid,exchange_rate,commission_thb,commission_rate,applied_commission_rate,partner_earnings_thb,taxable_margin_amount,rounding_diff_pot,pricing_snapshot,guest_name,metadata,
  listing:listings(id,title,category_id,categories(slug))
`

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @param {object[]} rows booking rows (pricing_snapshot + listing)
 * @returns {string} UTF-8 CSV with BOM for Excel
 */
export function renderPartnerFinancialStatementCsv(rows) {
  const safeRows = Array.isArray(rows) ? rows : []
  const dataRows = []
  for (const booking of safeRows) {
    const snap = buildBookingFinancialSnapshotFromRow(booking)
    if (!snap) continue
    dataRows.push([
      booking.id,
      listingTitleFromRow(booking),
      isoDateOnly(booking.created_at),
      isoDateOnly(booking.check_in),
      isoDateOnly(booking.check_out),
      round2(snap.gross).toFixed(2),
      round2(snap.fee).toFixed(2),
      round2(snap.net).toFixed(2),
      snap.status || booking.status || '',
    ])
  }
  return joinPartnerFinancesCsv(dataRows)
}

/**
 * @param {{ partnerId: string, fromYmd: string, toYmd: string, axis: 'created'|'checkout' }} opts
 */
export async function loadPartnerFinancesExportBookings({ partnerId, fromYmd, toYmd, axis }) {
  if (!partnerId) {
    return { success: false, error: 'PARTNER_ID_REQUIRED', status: 400 }
  }
  if (!isSupabaseConfigured() || !supabaseAdmin) {
    return { success: false, error: 'SERVICE_UNAVAILABLE', status: 503 }
  }

  const column = partnerFinancesExportAxisColumn(axis)
  const fromIso = `${fromYmd}T00:00:00.000Z`
  const toIso = `${toYmd}T23:59:59.999Z`

  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('partner_id', partnerId)
    .gte(column, fromIso)
    .lte(column, toIso)
    .order(column, { ascending: true })
    .limit(PARTNER_FINANCES_EXPORT_MAX_ROWS)

  if (error) {
    return { success: false, error: error.message || 'BOOKINGS_READ_FAILED', status: 500 }
  }

  return { success: true, rows: rows || [] }
}
