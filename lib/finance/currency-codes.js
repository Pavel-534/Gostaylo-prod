export const LISTING_BASE_CURRENCIES = ['THB', 'RUB', 'USD', 'USDT']
export const PAYOUT_CURRENCIES = ['RUB', 'THB', 'USDT', 'USD']
export const BOOKING_PAYMENT_CURRENCIES = ['THB', 'USD', 'RUB', 'CNY', 'USDT']

export function normalizeCurrencyCode(code, fallback = 'THB') {
  const normalized = String(code || '').toUpperCase().trim()
  return normalized || fallback
}

export function isListingBaseCurrency(code) {
  return LISTING_BASE_CURRENCIES.includes(normalizeCurrencyCode(code))
}

export function isBookingPaymentCurrency(code) {
  return BOOKING_PAYMENT_CURRENCIES.includes(normalizeCurrencyCode(code))
}

