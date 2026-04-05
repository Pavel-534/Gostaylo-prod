// Currency Conversion Utilities

// Default exchange rates (will be fetched from database in real implementation)
const DEFAULT_RATES = {
  THB: 1.0,
  RUB: 0.41,
  USD: 31.7,
  USDT: 31.7,
  EUR: 34.5,
  GBP: 40.2,
  CNY: 4.35,
}

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

// Convert from THB to target currency
export function convertFromThb(amountThb, targetCurrency, rates = DEFAULT_RATES) {
  if (targetCurrency === 'THB') return amountThb
  const rate = rates[targetCurrency] || DEFAULT_RATES[targetCurrency]
  return amountThb / rate
}

// Convert to THB from source currency
export function convertToThb(amount, sourceCurrency, rates = DEFAULT_RATES) {
  if (sourceCurrency === 'THB') return amount
  const rate = rates[sourceCurrency] || DEFAULT_RATES[sourceCurrency]
  return amount * rate
}

/**
 * Format a THB amount for display in the selected currency.
 * @param {number} amountThb — value in THB (may be negative, e.g. discounts)
 * @param {string} [currency='THB']
 * @param {Record<string, number>} [exchangeRates] — THB per 1 unit (same as /api/v2/exchange-rates rateMap)
 */
export function formatPrice(amountThb, currency = 'THB', exchangeRates = {}) {
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
  const formatted = rounded.toLocaleString('en-US', {
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