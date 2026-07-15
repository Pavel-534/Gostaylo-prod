/**
 * Stage 188.2 — server-side ambassador amounts for OG / SEO (mid FX, no THB leak for non-THB locales).
 */

import { formatAmbassadorAmountFromThb } from '@/lib/pricing/ambassador-display-amount.js'
import { getMidMarketDisplayRateMap } from '@/lib/pricing/fx-display.js'

/** Default display currency by UI/OG language (public pages without header currency). */
export const OG_LANG_DISPLAY_CURRENCY = {
  ru: 'RUB',
  en: 'USD',
  zh: 'USD',
  th: 'THB',
}

export function resolveOgDisplayCurrency(lang) {
  const code = String(lang || 'en').trim().slice(0, 2).toLowerCase()
  return OG_LANG_DISPLAY_CURRENCY[code] || 'USD'
}

/**
 * @param {number} thb
 * @param {string} lang
 * @param {Record<string, number>} [rateMap]
 */
export function formatAmbassadorAmountForOgLang(thb, lang, rateMap) {
  const currency = resolveOgDisplayCurrency(lang)
  const rates = rateMap && typeof rateMap === 'object' ? { THB: 1, ...rateMap } : { THB: 1 }
  return formatAmbassadorAmountFromThb(thb, currency, rates, lang)
}

/** Async helper — loads mid-market rates when rateMap omitted. */
export async function formatAmbassadorAmountForOgLangAsync(thb, lang) {
  let rateMap = { THB: 1 }
  try {
    rateMap = await getMidMarketDisplayRateMap()
  } catch {
    /* fallback THB-only */
  }
  return formatAmbassadorAmountForOgLang(thb, lang, rateMap)
}
