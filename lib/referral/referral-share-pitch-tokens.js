/**
 * Stage 179.3 — storefront FX SSOT for ambassador share/post copy (`useCurrency` + retail rateMap).
 */
import { formatDisplayPriceInCurrency } from '@/lib/pricing/fx-display-client'

export const REFERRAL_WELCOME_BONUS_THB_FALLBACK = 500

/**
 * @param {number | string | null | undefined} raw
 * @returns {number}
 */
export function resolveWelcomeBonusThb(raw) {
  const n = Math.round(Number(raw))
  return Number.isFinite(n) && n > 0 ? n : REFERRAL_WELCOME_BONUS_THB_FALLBACK
}

/**
 * Welcome bonus in the user's selected display currency (retail FX, same as catalog).
 * @param {number | string | null | undefined} welcomeBonusThb
 * @param {string} [currency]
 * @param {Record<string, number>} [rateMap]
 * @param {string} [language]
 */
export function formatWelcomeBonusDisplayAmount(
  welcomeBonusThb,
  currency = 'THB',
  rateMap = { THB: 1 },
  language = 'en',
) {
  const thb = resolveWelcomeBonusThb(welcomeBonusThb)
  const code = String(currency || 'THB').toUpperCase()
  const rates = rateMap && typeof rateMap === 'object' ? { THB: 1, ...rateMap } : { THB: 1 }
  return formatDisplayPriceInCurrency(thb, code, rates, language)
}

/**
 * @param {{
 *   welcomeBonusThb?: number | string | null,
 *   currency?: string,
 *   rateMap?: Record<string, number>,
 *   language?: string,
 *   brand?: string,
 *   link?: string,
 * }} opts
 */
export function buildReferralPitchTokens(opts = {}) {
  const welcomeAmount = formatWelcomeBonusDisplayAmount(
    opts.welcomeBonusThb,
    opts.currency,
    opts.rateMap,
    opts.language,
  )
  return {
    welcomeAmount,
    brand: String(opts.brand || '').trim(),
    link: String(opts.link || '').trim(),
  }
}

/**
 * @param {string} template
 * @param {{ welcomeAmount?: string, brand?: string, link?: string }} tokens
 */
export function applyReferralPitchTemplate(template, tokens) {
  return String(template || '')
    .replace(/\{brand\}/g, tokens.brand || '')
    .replace(/\{link\}/g, tokens.link || '')
    .replace(/\{welcomeAmount\}/g, tokens.welcomeAmount || '')
}
