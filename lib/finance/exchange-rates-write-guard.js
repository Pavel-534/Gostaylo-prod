/**
 * Stage 136.1 — guardrails for exchange_rates writes (smoke isolation + semantic validation).
 */
import { isProductionPaymentEnvironment } from '@/lib/payment/production-env.js'
import { normalizeThbPerUnitRate } from '@/lib/finance/thb-per-unit-rate.js'

/**
 * Smoke/e2e must not mutate config FX on production or prod DB targets (READ-ONLY).
 * Override only for isolated staging CI: SMOKE_ALLOW_EXCHANGE_RATES_MUTATION=1.
 */
export function isSmokeExchangeRatesWriteBlocked() {
  if (process.env.SMOKE_ALLOW_EXCHANGE_RATES_MUTATION === '1') {
    return false
  }
  if (isProductionPaymentEnvironment()) {
    return true
  }
  if (process.env.GOSTAYLO_PRODUCTION_DB === '1') {
    return true
  }
  if (process.env.SMOKE_FINANCIAL_RUN === '1') {
    const site = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.BASE_URL || '').toLowerCase()
    if (site.includes('airento.ru') || site.includes('airento.com')) {
      return true
    }
  }
  return false
}

/**
 * @param {string} currencyCode
 * @param {number} rateToThbRaw
 * @returns {{ ok: true, normalizedRate: number } | { ok: false, error: string, status: number }}
 */
export function validateExchangeRateSemantics(currencyCode, rateToThbRaw) {
  const code = String(currencyCode || '').toUpperCase().trim()
  const raw = Number(rateToThbRaw)
  if (!code) {
    return { ok: false, error: 'CURRENCY_CODE_REQUIRED', status: 400 }
  }
  if (!Number.isFinite(raw) || raw <= 0) {
    return { ok: false, error: 'RATE_TO_THB_MUST_BE_POSITIVE', status: 400 }
  }

  if (code === 'RUB' && raw >= 1) {
    return {
      ok: false,
      error: 'RUB_RATE_TO_THB_INVERTED',
      status: 400,
    }
  }

  const normalizedRate = normalizeThbPerUnitRate(code, raw)
  if (normalizedRate == null || normalizedRate <= 0) {
    return { ok: false, error: 'RATE_TO_THB_INVALID', status: 400 }
  }

  if (code === 'RUB' && normalizedRate >= 1) {
    return {
      ok: false,
      error: 'RUB_RATE_TO_THB_INVERTED',
      status: 400,
    }
  }

  return { ok: true, normalizedRate }
}

/**
 * @param {string} currencyCode
 * @param {number} rateToThbRaw
 * @param {string} [source]
 */
export function logExchangeRateValidationFailure(currencyCode, rateToThbRaw, source = 'unknown') {
  console.error(
    `[exchange_rates] REJECTED invalid rate semantics source=${source} currency=${currencyCode} rate_to_thb=${rateToThbRaw}`,
  )
}

export default {
  isSmokeExchangeRatesWriteBlocked,
  validateExchangeRateSemantics,
  logExchangeRateValidationFailure,
}
