/**
 * Stage 202.25 — Insurance fund % reader (FinTech policy / snapshot SSOT).
 */
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'

const MAX_INSURANCE_PERCENT = 10

/**
 * @param {Record<string, unknown> | null | undefined} policy camelCase or snake_case fintech policy
 */
export function readInsuranceFundPercent(policy) {
  const raw = policy?.insuranceFundPercent ?? policy?.insurance_fund_percent
  const n = Number(raw)
  if (!Number.isFinite(n)) {
    return FINTECH_CONFIG_DEFAULTS.insurance_fund_percent
  }
  if (n < 0 || n > MAX_INSURANCE_PERCENT) {
    throw new Error(`INSURANCE_FUND_PERCENT_OUT_OF_RANGE:${n}`)
  }
  return n
}

/**
 * @param {number} platformGrossRevenueThb
 * @param {Record<string, unknown> | null | undefined} policy
 */
export function computeInsuranceReserveThb(platformGrossRevenueThb, policy) {
  const gross = Number(platformGrossRevenueThb)
  const base = Number.isFinite(gross) && gross > 0 ? gross : 0
  const pct = readInsuranceFundPercent(policy)
  return Math.round(base * (pct / 100) * 100) / 100
}

export default {
  readInsuranceFundPercent,
  computeInsuranceReserveThb,
}
