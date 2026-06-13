/**
 * Stage 134 — referral payout FX policy (rate lock TTL, stale guard, lock resolution).
 * Separate from partner host FX (`lib/partner/partner-payout-fx.js`).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { parseEnvPositiveFloat } from '@/lib/services/currency.service.js'

/** FX lock validity after user withdrawal request. */
export const REFERRAL_FX_LOCK_TTL_MS = 48 * 60 * 60 * 1000

/** Payout preview / lock: RUB quote must be fresher than this (stricter than admin 24h alert). */
export const REFERRAL_PAYOUT_FX_STALE_MS = 6 * 60 * 60 * 1000

function round2(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function roundRub(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

/**
 * @param {string} [currency]
 * @returns {Promise<{ ok: true, rateToThb: number, updatedAt: string }>}
 */
export async function assertReferralPayoutFxFresh(currency = 'RUB') {
  const code = String(currency || 'RUB').toUpperCase().trim()
  if (code === 'THB') {
    return { ok: true, rateToThb: 1, updatedAt: new Date().toISOString() }
  }

  let rate = null
  let updatedAt = null

  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('exchange_rates')
      .select('rate_to_thb, updated_at')
      .eq('currency_code', code)
      .maybeSingle()
    if (data) {
      const r = Number(data.rate_to_thb)
      if (Number.isFinite(r) && r > 0) rate = r
      if (data.updated_at) updatedAt = String(data.updated_at)
    }
  }

  if (code === 'RUB' && (!rate || rate <= 0)) {
    const envRub = parseEnvPositiveFloat('FALLBACK_RATE_RUB_TO_THB')
    if (envRub) {
      rate = envRub
      updatedAt = updatedAt || new Date().toISOString()
    }
  }

  if (!rate || rate <= 0) {
    const err = new Error('REFERRAL_PAYOUT_FX_STALE_RATE')
    throw err
  }
  if (!updatedAt) {
    const err = new Error('REFERRAL_PAYOUT_FX_STALE_RATE')
    throw err
  }

  const ts = new Date(updatedAt).getTime()
  if (Number.isNaN(ts) || Date.now() - ts > REFERRAL_PAYOUT_FX_STALE_MS) {
    const err = new Error('REFERRAL_PAYOUT_FX_STALE_RATE')
    throw err
  }

  return { ok: true, rateToThb: rate, updatedAt }
}

/**
 * @param {object} preview — from buildReferralWithdrawalPreview (THB fee breakdown)
 * @param {{ amountInPayoutCurrency: number, midRateToThb: number }} fx
 * @param {string} [lockedAtIso]
 */
export function buildReferralWithdrawalFxLockMetadata(preview, fx, lockedAtIso = null) {
  const nowIso = lockedAtIso || new Date().toISOString()
  const expiresAt = new Date(new Date(nowIso).getTime() + REFERRAL_FX_LOCK_TTL_MS).toISOString()
  const payoutCurrency = String(preview?.payoutCurrency || 'RUB').toUpperCase()
  const rubAmount =
    payoutCurrency === 'RUB' ? roundRub(fx.amountInPayoutCurrency) : round2(fx.amountInPayoutCurrency)

  return {
    payout_currency: payoutCurrency,
    requested_fx_rate: fx.midRateToThb,
    requested_fx_rate_at: nowIso,
    requested_rub_amount: rubAmount,
    requested_net_thb: round2(preview.netThb),
    requested_gross_thb: round2(preview.grossThb),
    withdrawal_fee_thb: round2(preview.withdrawalFeeThb),
    withdrawal_fee_percent: round2(preview.withdrawalFeePercent),
    fx_lock_expires_at: expiresAt,
    fx_spread_pct: 0,
    fx_source: 'exchange_rates.mid',
  }
}

/**
 * @param {object | null | undefined} rawMetadata
 * @param {{ grossThb?: number }} [opts]
 */
export function resolveReferralFxLock(rawMetadata, opts = {}) {
  const meta = rawMetadata && typeof rawMetadata === 'object' ? rawMetadata : null
  if (!meta?.requested_fx_rate || meta?.requested_rub_amount == null) {
    return { ok: false, error: 'REFERRAL_PAYOUT_FX_LOCK_MISSING' }
  }

  const expiresAt = meta.fx_lock_expires_at ? String(meta.fx_lock_expires_at) : null
  if (expiresAt) {
    const expMs = new Date(expiresAt).getTime()
    if (!Number.isNaN(expMs) && expMs < Date.now()) {
      return { ok: false, error: 'REFERRAL_PAYOUT_FX_LOCK_EXPIRED', expired: true }
    }
  }

  const lockedGross = round2(meta.requested_gross_thb)
  const grossThb = opts.grossThb != null ? round2(opts.grossThb) : null
  if (grossThb != null && lockedGross > 0 && Math.abs(grossThb - lockedGross) > 0.02) {
    return { ok: false, error: 'REFERRAL_PAYOUT_FX_LOCK_GROSS_MISMATCH' }
  }

  const rate = Number(meta.requested_fx_rate)
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, error: 'REFERRAL_PAYOUT_FX_LOCK_MISSING' }
  }

  return {
    ok: true,
    requestedFxRate: rate,
    requestedFxRateAt: meta.requested_fx_rate_at || null,
    requestedRubAmount: roundRub(meta.requested_rub_amount),
    requestedNetThb: round2(meta.requested_net_thb),
    requestedGrossThb: lockedGross,
    fxLockExpiresAt: expiresAt,
    metadata: meta,
  }
}

/** @param {object | null | undefined} rawMetadata */
export function isReferralFxLockExpired(rawMetadata) {
  const meta = rawMetadata && typeof rawMetadata === 'object' ? rawMetadata : null
  const expiresAt = meta?.fx_lock_expires_at
  if (!expiresAt) return false
  const expMs = new Date(String(expiresAt)).getTime()
  return !Number.isNaN(expMs) && expMs < Date.now()
}

export const REFERRAL_WITHDRAWAL_CLEAR_PATCH = {
  referral_withdrawal_status: null,
  referral_withdrawal_requested_at: null,
  referral_withdrawal_amount_thb: null,
  referral_withdrawal_metadata: null,
}

export default {
  REFERRAL_FX_LOCK_TTL_MS,
  REFERRAL_PAYOUT_FX_STALE_MS,
  assertReferralPayoutFxFresh,
  buildReferralWithdrawalFxLockMetadata,
  resolveReferralFxLock,
  isReferralFxLockExpired,
  REFERRAL_WITHDRAWAL_CLEAR_PATCH,
}
