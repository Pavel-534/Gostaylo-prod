function normalizeCurrencyCode(currency) {
  return String(currency || 'THB').toUpperCase().trim()
}

export async function getExchangeRates() {
  const { getDisplayRateMap } = await import('@/lib/services/currency.service.js')
  const map = await getDisplayRateMap()
  const symbol = { THB: '฿', RUB: '₽', USD: '$', USDT: '₮', EUR: '€', GBP: '£', CNY: '¥' }
  return Object.entries(map)
    .filter(([, v]) => Number.isFinite(Number(v)) && Number(v) > 0)
    .map(([code, rateToThb]) => ({
      code,
      rateToThb: Number(rateToThb),
      symbol: symbol[code] || code,
    }))
}

export async function getRawRateMap() {
  const { getDisplayRateMap } = await import('@/lib/services/currency.service.js')
  return getDisplayRateMap({ applyRetailMarkup: false })
}

export async function getCheckoutRateToThb(paymentCurrency = 'THB', listingBaseCurrency = 'THB') {
  const pay = normalizeCurrencyCode(paymentCurrency)
  const base = normalizeCurrencyCode(listingBaseCurrency)
  if (pay === 'THB') return 1

  const rawMap = await getRawRateMap()
  const rawRate = Number(rawMap?.[pay])
  if (!Number.isFinite(rawRate) || rawRate <= 0) return 1
  if (pay === base) return rawRate

  const { resolveChatInvoiceRateMultiplier } = await import('@/lib/services/currency.service.js')
  const multiplier = await resolveChatInvoiceRateMultiplier()
  const safeMultiplier = Number(multiplier)
  if (!Number.isFinite(safeMultiplier) || safeMultiplier <= 1) return rawRate
  return rawRate / safeMultiplier
}

export async function convertThbToCurrencyRaw(amountThb, targetCurrency = 'THB', rawRateMap = null) {
  const target = normalizeCurrencyCode(targetCurrency)
  const thb = Number(amountThb)
  if (!Number.isFinite(thb)) return 0
  if (target === 'THB') return thb
  const map = rawRateMap || (await getRawRateMap())
  const rate = Number(map?.[target])
  if (!Number.isFinite(rate) || rate <= 0) return thb
  return thb / rate
}

export async function convertPrice(amountThb, targetCurrency) {
  const rates = await getExchangeRates()
  const rate = rates.find((r) => r.code === targetCurrency)
  if (!rate) return { amount: amountThb, currency: 'THB' }
  return {
    amount: amountThb / rate.rateToThb,
    currency: targetCurrency,
    rate: rate.rateToThb,
  }
}
