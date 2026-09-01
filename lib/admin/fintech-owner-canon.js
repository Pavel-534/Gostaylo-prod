/**
 * Stage 202.21 — Owner-signed live canon for FinTech observability (post Aug 2026 cutover).
 * Used for admin banner «live ≠ expected» — not bootstrap-only defaults.
 */
import { MARKETING_FINTECH_LEGACY_GENERAL_KEYS } from '@/lib/admin/marketing-fintech-legacy-keys.js'

/** @type {Readonly<Record<string, number | boolean>>} */
export const FINTECH_OWNER_CANON = Object.freeze({
  referral_reinvestment_percent: 45,
  acquiring_fee_percent: 4.3,
  referral_monthly_program_cap_thb: 1_000_000,
  ambassador_guest_l3_enabled: true,
  ambassador_guest_pool_l1_percent: 42,
  ambassador_guest_pool_l2_percent: 10,
  ambassador_guest_pool_l3_percent: 5,
  ambassador_guest_pool_referee_percent: 43,
  insurance_fund_percent: 0.5,
})

const CANON_BANNER_KEYS = Object.freeze([
  'referral_reinvestment_percent',
  'acquiring_fee_percent',
  'referral_monthly_program_cap_thb',
  'ambassador_guest_l3_enabled',
  'insurance_fund_percent',
])

/**
 * @param {Record<string, unknown> | null | undefined} live snake_case from GET fintech-settings
 */
export function compareFintechLiveToOwnerCanon(live) {
  if (!live || typeof live !== 'object') {
    return { differs: false, diff: {} }
  }
  /** @type {Record<string, { live: unknown, expected: unknown }>} */
  const diff = {}
  for (const key of CANON_BANNER_KEYS) {
    const expected = FINTECH_OWNER_CANON[key]
    const raw = live[key]
    if (raw === undefined || raw === null) continue
    const liveVal = typeof expected === 'boolean' ? raw === true : Number(raw)
    if (typeof expected === 'boolean') {
      if (liveVal !== expected) diff[key] = { live: liveVal, expected }
    } else if (!Number.isFinite(liveVal) || Math.abs(liveVal - expected) > 0.001) {
      diff[key] = { live: liveVal, expected }
    }
  }
  return { differs: Object.keys(diff).length > 0, diff }
}

/**
 * Fintech SSOT keys sent from legacy Marketing UI/API — ignored on save (FinTech panel only).
 * @param {Record<string, unknown> | null | undefined} body
 * @returns {string[]}
 */
export function findIgnoredFintechKeysInMarketingBody(body) {
  if (!body || typeof body !== 'object') return []
  const ignored = []
  for (const k of MARKETING_FINTECH_LEGACY_GENERAL_KEYS) {
    if (body[k] !== undefined && body[k] !== null && body[k] !== '') {
      ignored.push(k)
    }
  }
  return ignored
}
