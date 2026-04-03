/**
 * Centralized FX for chat invoices: DB first, then external API, then CurrencyService resolver.
 * COMMISSION_MODIFIER applies +2% to the customer-facing conversion result.
 */

import { resolveThbPerUsdt } from '@/lib/services/currency.service'

/** +2% applied to effective rate (renter pays slightly more USDT / sees higher THB equivalent). */
export const COMMISSION_MODIFIER = 1.02

function normalizeCode(c) {
  return String(c || '').toUpperCase().trim()
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
