// Currency display utilities (symbols, list). FX numbers for UI come from
// GET /api/v2/exchange-rates → rateMap (THB per 1 unit); see TECHNICAL_MANIFESTO.md §1.

export const CURRENCIES = [
  { code: 'THB', symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
  { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', flag: '🇷🇺' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
  { code: 'USDT', symbol: '₮', name: 'Tether', flag: '💎' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  { code: 'KRW', symbol: '₩', name: 'Korean Won', flag: '🇰🇷' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
]

/** UI language code → BCP 47 for number grouping (thousands separators). */
export function languageToNumberLocale(language) {
  const l = String(language || 'en').toLowerCase().slice(0, 2)
  const map = { ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', th: 'th-TH' }
  return map[l] || 'en-US'
}

/**
 * Format a THB amount for display in the selected currency.
 * @param {number} amountThb — value in THB (may be negative, e.g. discounts)
 * @param {string} [currency='THB']
 * @param {Record<string, number>} [exchangeRates] — THB per 1 unit (same as /api/v2/exchange-rates rateMap)
 * @param {string} [language='en'] — UI language for digit grouping (ru-RU spaces, en-US commas, etc.)
 */
export function formatPrice(amountThb, currency = 'THB', exchangeRates = {}, language = 'en') {
  const code = currency || 'THB'
  const currencyInfo = CURRENCIES.find((c) => c.code === code)
  const symbol = currencyInfo?.symbol || '฿'

  if (amountThb == null || Number.isNaN(Number(amountThb))) {
    return `${symbol}0`
  }

  let n = Number(amountThb)
  const rates = exchangeRates && typeof exchangeRates === 'object' ? exchangeRates : {}
  if (code !== 'THB' && rates[code] != null) {
    const rate = Number(rates[code])
    if (Number.isFinite(rate) && rate > 0) {
      n = n / rate
    }
  }

  const maxFrac = code === 'JPY' ? 0 : 2
  const rounded = Math.round(n * 10 ** maxFrac) / 10 ** maxFrac
  const formatted = rounded.toLocaleString(languageToNumberLocale(language), {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  })

  return `${symbol}${formatted}`
}

// Get currency info
export function getCurrencyInfo(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0]
}

/** Метаданные для отображения (geo API и т.д.); неизвестный код — безопасный fallback. */
export function getCurrencyDisplayMeta(code) {
  const c = CURRENCIES.find((x) => x.code === code)
  if (c) return c
  return { code, symbol: code, name: code, flag: '🌐' }
}