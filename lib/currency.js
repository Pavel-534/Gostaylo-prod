// Currency Conversion Utilities

// Default exchange rates (will be fetched from database in real implementation)
const DEFAULT_RATES = {
  THB: 1.0,
  RUB: 0.37,
  USD: 33.5,
  USDT: 33.5,
}

export const CURRENCIES = [
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'USDT', symbol: '₮', name: 'Tether' },
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

// Format price with currency symbol
export function formatPrice(amount, currency) {
  const currencyInfo = CURRENCIES.find(c => c.code === currency)
  const symbol = currencyInfo?.symbol || '฿'
  
  // Round to 2 decimal places
  const rounded = Math.round(amount * 100) / 100
  
  // Format with thousand separators
  const formatted = rounded.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  
  return `${symbol}${formatted}`
}

// Get currency info
export function getCurrencyInfo(code) {
  return CURRENCIES.find(c => c.code === code) || CURRENCIES[0]
}