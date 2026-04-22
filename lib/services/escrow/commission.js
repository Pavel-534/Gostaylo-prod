import { supabaseAdmin } from '@/lib/supabase'
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service'
import { ESCROW_THAW_DAYS, PAYOUT_HOUR } from './constants.js'
import { extractSettlementSnapshot, normalizeDelayDays, normalizePayoutHour } from './utils.js'

export async function getSettlementPolicy() {
  try {
    const { data } = await supabaseAdmin
      .from('system_settings')
      .select('value')
      .eq('key', 'general')
      .maybeSingle()
    const delayDays = normalizeDelayDays(data?.value?.settlementPayoutDelayDays, ESCROW_THAW_DAYS)
    const payoutHourLocal = normalizePayoutHour(data?.value?.settlementPayoutHourLocal, PAYOUT_HOUR)
    return { delayDays, payoutHourLocal }
  } catch {
    return { delayDays: ESCROW_THAW_DAYS, payoutHourLocal: PAYOUT_HOUR }
  }
}

export async function getCurrentCommissionRate() {
  const pct = await resolveDefaultCommissionPercent()
  return pct / 100
}

export async function snapshotCommissionRate(bookingId) {
  try {
    const rate = await getCurrentCommissionRate()

    const { error } = await supabaseAdmin
      .from('bookings')
      .update({
        applied_commission_rate: rate,
        metadata: supabaseAdmin.rpc('jsonb_set_key', {
          jsonb_data: {},
          key_path: ['commission_snapshotted_at'],
          new_value: new Date().toISOString(),
        }),
      })
      .eq('id', bookingId)

    if (error) {
      await supabaseAdmin
        .from('bookings')
        .update({ applied_commission_rate: rate })
        .eq('id', bookingId)
    }

    console.log(`[COMMISSION SNAPSHOT] Booking ${bookingId}: ${(rate * 100).toFixed(1)}%`)
    return { success: true, rate }
  } catch (error) {
    console.error('[COMMISSION SNAPSHOT] Error:', error)
    const pct = await resolveDefaultCommissionPercent()
    return { success: false, rate: pct / 100 }
  }
}

export async function getBookingCommissionRate(booking) {
  const settlement = extractSettlementSnapshot(booking)
  const fromSnapshot = parseFloat(settlement?.applied_commission_rate)
  if (Number.isFinite(fromSnapshot) && fromSnapshot >= 0) return fromSnapshot / 100

  if (booking?.applied_commission_rate !== undefined && booking.applied_commission_rate !== null) {
    const r = parseFloat(booking.applied_commission_rate)
    if (Number.isFinite(r) && r >= 0) return r > 1 ? r / 100 : r
  }
  const cr = parseFloat(booking?.commission_rate)
  if (Number.isFinite(cr) && cr >= 0) return cr / 100
  const pct = await resolveDefaultCommissionPercent()
  return pct / 100
}
