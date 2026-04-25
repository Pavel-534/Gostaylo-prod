import { supabaseAdmin } from '@/lib/supabase'
import { readFeeSplitFromSnapshot } from '@/lib/services/booking/pricing.service'

function toNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function round2(value) {
  return Math.round(toNumber(value, 0) * 100) / 100
}

export function buildBookingFinancialSnapshotFromRow(booking) {
  if (!booking || typeof booking !== 'object') return null
  const snapshot =
    booking.pricing_snapshot && typeof booking.pricing_snapshot === 'object'
      ? booking.pricing_snapshot
      : {}
  const feeSplit = readFeeSplitFromSnapshot(snapshot)
  const settlement = snapshot?.settlement_v3 || null

  const subtotalThb = round2(booking.price_thb)
  const guestServiceFeeThb = Number.isFinite(feeSplit?.guestServiceFeeThb)
    ? round2(feeSplit.guestServiceFeeThb)
    : round2(booking.commission_thb)
  const hostCommissionThb = Number.isFinite(feeSplit?.hostCommissionThb)
    ? round2(feeSplit.hostCommissionThb)
    : round2(subtotalThb * (toNumber(booking.applied_commission_rate ?? booking.commission_rate, 0) / 100))

  const roundingDiffPotThb = round2(booking.rounding_diff_pot)
  const guestPayableThb = Number.isFinite(toNumber(snapshot?.fee_split_v2?.guest_payable_rounded_thb, NaN))
    ? round2(snapshot.fee_split_v2.guest_payable_rounded_thb)
    : round2(toNumber(booking.price_paid, 0) * toNumber(booking.exchange_rate, 0))

  const partnerPayoutThb = settlement?.partner_net?.thb != null
    ? round2(settlement.partner_net.thb)
    : round2(booking.partner_earnings_thb)

  const platformMarginThb = settlement?.platform_margin?.thb != null
    ? round2(settlement.platform_margin.thb)
    : round2(guestServiceFeeThb + hostCommissionThb)

  const insuranceReserveThb = settlement?.insurance_reserve_amount?.thb != null
    ? round2(settlement.insurance_reserve_amount.thb)
    : round2(snapshot?.fee_split_v2?.insurance_reserve_thb)

  const taxableMarginAmountThb = settlement?.taxable_margin_amount?.thb != null
    ? round2(settlement.taxable_margin_amount.thb)
    : round2(booking.taxable_margin_amount)

  return {
    bookingId: String(booking.id),
    status: String(booking.status || ''),
    currency: String(booking.currency || 'THB'),
    listingCurrency: String(booking.listing_currency || 'THB'),
    subtotalThb,
    guestServiceFeeThb,
    hostCommissionThb,
    roundingDiffPotThb,
    guestPayableThb,
    partnerPayoutThb,
    platformMarginThb,
    insuranceReserveThb,
    taxableMarginAmountThb,
    source: {
      feeSplitV2: Boolean(feeSplit),
      settlementV3: Boolean(settlement),
    },
  }
}

/**
 * SSOT read-model for booking financials.
 * This must be used by API/UI integrations instead of re-deriving totals ad-hoc.
 */
export async function readBookingFinancialSnapshot(bookingId) {
  const id = String(bookingId || '').trim()
  if (!id) return { success: false, error: 'BOOKING_ID_REQUIRED' }

  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select(
      'id,status,currency,listing_currency,price_thb,price_paid,exchange_rate,commission_thb,commission_rate,applied_commission_rate,partner_earnings_thb,taxable_margin_amount,rounding_diff_pot,pricing_snapshot',
    )
    .eq('id', id)
    .maybeSingle()

  if (error) return { success: false, error: error.message || 'BOOKING_READ_FAILED' }
  if (!data) return { success: false, error: 'BOOKING_NOT_FOUND' }

  const snapshot = buildBookingFinancialSnapshotFromRow(data)
  return { success: true, data: snapshot }
}

