/**
 * Stage 146 — lightweight booking financial context for chat enrich (?enrich=1).
 */
import { getHostMoneyStageKey } from '@/lib/booking/host-money-stage.js'

/**
 * @param {Record<string, unknown> | null | undefined} booking
 * @returns {Record<string, unknown> | null}
 */
export function enrichBookingFinancialSnapshot(booking) {
  if (!booking || typeof booking !== 'object') return null

  const priceThb = Number(booking.price_thb)
  const partnerEarnings = Number(booking.partner_earnings_thb)
  const commissionThb = Number(booking.commission_thb)
  const commissionRate = Number(booking.commission_rate)

  return {
    ...booking,
    financial_snapshot: {
      guest_total_thb: Number.isFinite(priceThb) ? priceThb : null,
      partner_earnings_thb: Number.isFinite(partnerEarnings) ? partnerEarnings : null,
      commission_thb: Number.isFinite(commissionThb) ? commissionThb : null,
      commission_rate: Number.isFinite(commissionRate) ? commissionRate : null,
      host_money_stage: getHostMoneyStageKey(booking.status),
    },
  }
}
