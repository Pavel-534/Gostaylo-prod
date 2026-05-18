/**
 * Stage 100.6 — SSOT: THB ledger → partner payout currency (RUB / USDT / THB).
 * RUB rails: mid rate from exchange_rates, minus platform payout spread (not guest retail +3%).
 * USDT: clean mid THB/USDT.
 *
 * @see lib/services/pricing/pricing-fx-helpers.js (raw mid map)
 */

import { getRawRateMap } from '@/lib/services/pricing/pricing-fx-helpers.js'
import {
  RUB_PAYOUT_METHOD_IDS,
  USDT_PAYOUT_METHOD_ID,
  resolvePayoutCurrency,
} from '@/lib/partner/payout-currency'
export { RUB_PAYOUT_METHOD_IDS, USDT_PAYOUT_METHOD_ID, resolvePayoutCurrency }

const OPEN_PAYOUT_RESERVE_STATUSES = ['PENDING', 'PROCESSING']

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

export function isRubPayoutRail(payoutMethodId, method = null) {
  return resolvePayoutCurrency(payoutMethodId, method) === 'RUB'
}

/**
 * Platform payout spread on RUB (partner receives fewer RUB per THB). Env override.
 * @returns {number} percent 0–100
 */
export function getRubPayoutSpreadPct() {
  const raw = process.env.PARTNER_PAYOUT_FX_RUB_SPREAD_PCT
  const n = Number(raw)
  if (Number.isFinite(n) && n >= 0 && n <= 25) return n
  return 1.75
}

/**
 * @param {number} thbAmount
 * @param {string} payoutCurrency
 * @param {string | null} [payoutMethodId]
 * @param {{ rawRateMap?: Record<string, number>, spreadPct?: number }} [opts]
 */
export async function convertThbToPayoutCurrency(thbAmount, payoutCurrency, payoutMethodId = null, opts = {}) {
  const thb = round2(thbAmount)
  const currency = resolvePayoutCurrency(payoutMethodId, { currency: payoutCurrency })
  const rawMap = opts.rawRateMap || (await getRawRateMap())

  if (currency === 'THB' || thb <= 0) {
    return {
      amountInPayoutCurrency: thb,
      payoutCurrency: 'THB',
      amountThb: thb,
      baseRateToThb: 1,
      effectiveRateToThb: 1,
      spreadPct: 0,
      midAmountInPayoutCurrency: thb,
    }
  }

  const baseRateToThb = Number(rawMap?.[currency])
  if (!Number.isFinite(baseRateToThb) || baseRateToThb <= 0) {
    throw new Error(`PAYOUT_FX_RATE_UNAVAILABLE:${currency}`)
  }

  const midAmount = round2(thb / baseRateToThb)
  let spreadPct = 0
  let amountInPayoutCurrency = midAmount

  if (currency === 'RUB') {
    spreadPct = Number.isFinite(opts.spreadPct) ? opts.spreadPct : getRubPayoutSpreadPct()
    amountInPayoutCurrency = round2(midAmount * (1 - spreadPct / 100))
  }

  const effectiveRateToThb =
    amountInPayoutCurrency > 0 ? round2(thb / amountInPayoutCurrency) : baseRateToThb

  return {
    amountInPayoutCurrency,
    payoutCurrency: currency,
    amountThb: thb,
    baseRateToThb: round2(baseRateToThb),
    effectiveRateToThb,
    spreadPct: round2(spreadPct),
    midAmountInPayoutCurrency: midAmount,
  }
}

/**
 * Min payout on method is in method.currency — compare after FX.
 * @param {number} baseThb
 * @param {{ min_payout?: number, currency?: string, id?: string }} payoutMethod
 */
export async function assertMinPayoutInMethodCurrency(baseThb, payoutMethod) {
  const method = payoutMethod || {}
  const min = Math.max(0, Number(method.min_payout) || 0)
  if (min <= 0) return { ok: true }

  const payoutCurrency = resolvePayoutCurrency(method.id, method)
  const fx = await convertThbToPayoutCurrency(baseThb, payoutCurrency, method.id)
  if (fx.amountInPayoutCurrency < min) {
    return {
      ok: false,
      error: `Minimum payout for this method is ${min} ${payoutCurrency}`,
      fx,
    }
  }
  return { ok: true, fx }
}

/**
 * Sum THB reserved by open partner withdrawal requests (ledger untouched).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} partnerId
 */
export async function sumPendingPartnerPayoutReserveThb(supabaseAdmin, partnerId) {
  if (!supabaseAdmin || !partnerId) return 0
  const { data, error } = await supabaseAdmin
    .from('payouts')
    .select('gross_amount, final_amount, amount')
    .eq('partner_id', partnerId)
    .in('status', OPEN_PAYOUT_RESERVE_STATUSES)

  if (error) {
    console.error('[PAYOUT RESERVE]', error)
    return 0
  }

  let sum = 0
  for (const row of data || []) {
    const thb =
      Number(row.gross_amount) ||
      Number(row.final_amount) ||
      Number(row.amount) ||
      0
    if (Number.isFinite(thb) && thb > 0) sum += thb
  }
  return round2(sum)
}

/**
 * Partner IDs with open payout requests — exclude their bookings from treasury pools.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 */
export async function listPartnerIdsWithOpenPayoutRequests(supabaseAdmin) {
  if (!supabaseAdmin) return new Set()
  const { data, error } = await supabaseAdmin
    .from('payouts')
    .select('partner_id')
    .in('status', OPEN_PAYOUT_RESERVE_STATUSES)

  if (error) {
    console.error('[PAYOUT RESERVE] list partners', error)
    return new Set()
  }
  return new Set((data || []).map((r) => r.partner_id).filter(Boolean))
}

export function buildPayoutFxMetadata(fxResult) {
  return {
    payout_fx: {
      payout_currency: fxResult.payoutCurrency,
      amount_in_payout_currency: fxResult.amountInPayoutCurrency,
      base_rate_to_thb: fxResult.baseRateToThb,
      effective_rate_to_thb: fxResult.effectiveRateToThb,
      spread_pct: fxResult.spreadPct,
      mid_amount_in_payout_currency: fxResult.midAmountInPayoutCurrency,
      computed_at: new Date().toISOString(),
    },
  }
}

/**
 * Method fee on THB base (fixed fee is in method.currency when not THB).
 * @param {number} basePayoutAmountThb
 * @param {{ fee_type?: string, value?: number, currency?: string, min_payout?: number, id?: string } | null} payoutMethod
 * @param {{ rawRateMap?: Record<string, number> }} [opts]
 */
export async function computePayoutFeeThb(basePayoutAmountThb, payoutMethod, opts = {}) {
  const base = Math.max(0, Number(basePayoutAmountThb) || 0)
  const method = payoutMethod || null
  if (!method) {
    return { feeAmount: 0, finalAmountThb: base, baseAmountThb: base }
  }

  const minCheck = await assertMinPayoutInMethodCurrency(base, method)
  if (!minCheck.ok) {
    return { error: minCheck.error, baseAmountThb: base, feeAmount: 0, finalAmountThb: base }
  }

  const feeType = String(method.fee_type || 'fixed').toLowerCase()
  const value = Math.max(0, Number(method.value) || 0)
  let feeAmountThb = 0

  if (feeType === 'percentage') {
    feeAmountThb = round2(base * (value / 100))
  } else {
    const feeCurrency = resolvePayoutCurrency(method.id, method)
    if (feeCurrency === 'THB') {
      feeAmountThb = round2(value)
    } else {
      const rawMap = opts.rawRateMap || (await getRawRateMap())
      const rate = Number(rawMap?.[feeCurrency])
      if (!Number.isFinite(rate) || rate <= 0) {
        return { error: `PAYOUT_FX_RATE_UNAVAILABLE:${feeCurrency}`, baseAmountThb: base }
      }
      feeAmountThb = round2(value * rate)
    }
  }

  const finalAmountThb = Math.max(0, round2(base - feeAmountThb))
  const payoutCurrency = resolvePayoutCurrency(method.id, method)
  const fx = await convertThbToPayoutCurrency(finalAmountThb, payoutCurrency, method.id, opts)

  return {
    baseAmountThb: base,
    feeAmount: feeAmountThb,
    finalAmountThb,
    feeType,
    feeValue: value,
    fx,
    amountInPayoutCurrency: fx.amountInPayoutCurrency,
    payoutCurrency: fx.payoutCurrency,
  }
}
