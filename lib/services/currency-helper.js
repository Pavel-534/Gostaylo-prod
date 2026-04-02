/**
 * Centralized FX for chat invoices: DB first, then external API, then fallback.
 * COMMISSION_MODIFIER applies +2% to the customer-facing conversion result.
 */

import { supabaseAdmin } from '@/lib/supabase'

/** +2% applied to effective rate (renter pays slightly more USDT / sees higher THB equivalent). */
export const COMMISSION_MODIFIER = 1.02

const STALE_MS = 24 * 60 * 60 * 1000
const FALLBACK_THB_PER_USDT = 35.5

function normalizeCode(c) {
  return String(c || '').toUpperCase().trim()
}

/**
 * @returns {Promise<number|null>} THB per 1 USDT, or null if unusable
 */
async function fetchThbPerUsdtFromDb() {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('exchange_rates')
    .select('rate_to_thb, updated_at')
    .eq('currency_code', 'USDT')
    .maybeSingle()

  if (error || !data) return null
  const r = parseFloat(data.rate_to_thb)
  if (!Number.isFinite(r) || r <= 0) return null

  const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : NaN
  if (Number.isNaN(updatedAt) || Date.now() - updatedAt > STALE_MS) return null

  return r
}

/**
 * ExchangeRate-API v6: base THB → conversion_rates.USDT is USDT per 1 THB → THB per USDT = 1 / that.
 * @returns {Promise<number|null>}
 */
async function fetchThbPerUsdtFromExternal() {
  const key = process.env.EXCHANGE_RATE_KEY || process.env.EXCHANGE_API_KEY
  if (!key) return null

  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${key}/latest/THB`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const j = await res.json()
    if (j.result !== 'success' || !j.conversion_rates || typeof j.conversion_rates !== 'object') {
      return null
    }
    const usdtPerThb = j.conversion_rates.USDT ?? j.conversion_rates.USD
    const v = parseFloat(usdtPerThb)
    if (!Number.isFinite(v) || v <= 0) return null
    return 1 / v
  } catch {
    return null
  }
}

async function resolveThbPerUsdt() {
  const fromDb = await fetchThbPerUsdtFromDb()
  if (fromDb != null) return fromDb

  const fromApi = await fetchThbPerUsdtFromExternal()
  if (fromApi != null) return fromApi

  return FALLBACK_THB_PER_USDT
}

/**
 * Effective multiplier: amount in baseCurrency × rate = amount in targetCurrency (after +2% commission).
 * Supported pairs: THB↔USDT (chat invoice use-case).
 *
 * @param {string} baseCurrency
 * @param {string} targetCurrency
 * @returns {Promise<number>}
 */
export async function getEffectiveRate(baseCurrency, targetCurrency) {
  const base = normalizeCode(baseCurrency)
  const target = normalizeCode(targetCurrency)

  if (base === target) return 1

  const thbPerUsdt = await resolveThbPerUsdt()

  if (base === 'THB' && target === 'USDT') {
    return (1 / thbPerUsdt) * COMMISSION_MODIFIER
  }
  if (base === 'USDT' && target === 'THB') {
    return thbPerUsdt * COMMISSION_MODIFIER
  }

  throw new Error(`Unsupported currency pair for chat invoice: ${base} → ${target}`)
}
