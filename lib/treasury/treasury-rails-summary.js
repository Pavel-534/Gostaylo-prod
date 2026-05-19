/**
 * Stage 104 — агрегаты «готово к выплате» и удержание 24ч по рельсам.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  getPayoutRailMeta,
  PAYOUT_RAIL,
  resolvePayoutRailForPartnerCurrency,
} from '@/lib/treasury/payout-rails.js'
import {
  getBookingEscrowThawedAtMs,
  isWithdrawalHoldElapsed,
  isBookingDisputePaymentFrozen,
} from '@/lib/partner/partner-payout-eligibility.js'
import DisputeService from '@/lib/services/dispute.service.js'

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

/**
 * @returns {Promise<{
 *   rails: Record<string, { rail: string, label: string, readyCount: number, readyThb: number }>,
 *   awaitingConversion: { count: number, thb: number },
 *   totalReadyCount: number,
 *   totalReadyThb: number,
 * }>}
 */
export async function loadTreasuryRailsSummary() {
  const emptyRails = () => ({
    [PAYOUT_RAIL.RUB_DIRECT]: {
      rail: PAYOUT_RAIL.RUB_DIRECT,
      label: getPayoutRailMeta(PAYOUT_RAIL.RUB_DIRECT).ownerLabel,
      readyCount: 0,
      readyThb: 0,
    },
    [PAYOUT_RAIL.INTERNATIONAL]: {
      rail: PAYOUT_RAIL.INTERNATIONAL,
      label: getPayoutRailMeta(PAYOUT_RAIL.INTERNATIONAL).ownerLabel,
      readyCount: 0,
      readyThb: 0,
    },
  })

  if (!supabaseAdmin) {
    return {
      rails: emptyRails(),
      awaitingConversion: { count: 0, thb: 0 },
      totalReadyCount: 0,
      totalReadyThb: 0,
    }
  }

  const nowMs = Date.now()
  const rails = emptyRails()
  let awaitingCount = 0
  let awaitingThb = 0

  const { data: readyRows } = await supabaseAdmin
    .from('bookings')
    .select('id, partner_id, partner_earnings_thb, status, metadata')
    .eq('status', 'READY_FOR_PAYOUT')
    .gt('partner_earnings_thb', 0)
    .limit(5000)

  const { data: thawedRows } = await supabaseAdmin
    .from('bookings')
    .select('id, partner_id, partner_earnings_thb, status, metadata')
    .eq('status', 'THAWED')
    .gt('partner_earnings_thb', 0)
    .limit(5000)

  const partnerIds = [
    ...new Set(
      [...(readyRows || []), ...(thawedRows || [])].map((b) => b.partner_id).filter(Boolean),
    ),
  ]

  const currencyByPartner = new Map()
  if (partnerIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, preferred_payout_currency, preferred_currency')
      .in('id', partnerIds)
    for (const p of profiles || []) {
      currencyByPartner.set(
        p.id,
        p.preferred_payout_currency || p.preferred_currency || 'THB',
      )
    }
  }

  const frozenSet = await DisputeService.getFrozenBookingIdSet(
    [...(readyRows || []), ...(thawedRows || [])].map((b) => b.id),
  )

  for (const b of readyRows || []) {
    if (isBookingDisputePaymentFrozen(b, frozenSet)) continue
    const cur = currencyByPartner.get(b.partner_id) || 'THB'
    const rail = resolvePayoutRailForPartnerCurrency(cur)
    const net = round2(b.partner_earnings_thb)
    rails[rail].readyCount += 1
    rails[rail].readyThb = round2(rails[rail].readyThb + net)
  }

  for (const b of thawedRows || []) {
    if (isBookingDisputePaymentFrozen(b, frozenSet)) continue
    const net = round2(b.partner_earnings_thb)
    if (!getBookingEscrowThawedAtMs(b)) continue
    if (isWithdrawalHoldElapsed(b, nowMs)) continue
    awaitingCount += 1
    awaitingThb = round2(awaitingThb + net)
  }

  const totalReadyCount =
    rails[PAYOUT_RAIL.RUB_DIRECT].readyCount + rails[PAYOUT_RAIL.INTERNATIONAL].readyCount
  const totalReadyThb = round2(
    rails[PAYOUT_RAIL.RUB_DIRECT].readyThb + rails[PAYOUT_RAIL.INTERNATIONAL].readyThb,
  )

  return {
    rails,
    awaitingConversion: { count: awaitingCount, thb: awaitingThb },
    totalReadyCount,
    totalReadyThb,
  }
}
