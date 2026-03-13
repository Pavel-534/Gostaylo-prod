/**
 * Booking Logic Utilities
 * 
 * Centralized functions for:
 * - Price calculations
 * - Date formatting
 * - Night counting
 * - Commission calculations
 * 
 * DRY: Use these instead of inline calculations
 * 
 * @created 2026-03-13
 */

import { format, differenceInDays, parseISO, isSameDay } from 'date-fns'
import { ru, enUS } from 'date-fns/locale'

const locales = { ru, en: enUS }

/**
 * Calculate number of nights between two dates
 */
export function calculateNights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0
  
  const from = typeof checkIn === 'string' ? parseISO(checkIn) : checkIn
  const to = typeof checkOut === 'string' ? parseISO(checkOut) : checkOut
  
  if (isSameDay(from, to)) return 0
  
  return differenceInDays(to, from)
}

/**
 * Calculate total price for a stay
 */
export function calculateTotalPrice(basePricePerNight, nights, options = {}) {
  if (!basePricePerNight || !nights || nights <= 0) return 0
  
  const {
    commissionRate = 0, // Percentage (e.g., 15 for 15%)
    cleaningFee = 0,
    serviceFeeRate = 0 // Percentage
  } = options
  
  const subtotal = basePricePerNight * nights
  const commission = subtotal * (commissionRate / 100)
  const serviceFee = subtotal * (serviceFeeRate / 100)
  
  return subtotal + commission + serviceFee + cleaningFee
}

/**
 * Format date range for display
 */
export function formatDateRange(checkIn, checkOut, language = 'en') {
  if (!checkIn) return ''
  
  const locale = locales[language] || enUS
  const from = typeof checkIn === 'string' ? parseISO(checkIn) : checkIn
  
  if (!checkOut) {
    return `${format(from, 'd MMM', { locale })} — ...`
  }
  
  const to = typeof checkOut === 'string' ? parseISO(checkOut) : checkOut
  
  if (isSameDay(from, to)) {
    return format(from, 'd MMM yyyy', { locale })
  }
  
  // Same month and year
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${from.getDate()} — ${format(to, 'd MMM', { locale })}`
  }
  
  return `${format(from, 'd MMM', { locale })} — ${format(to, 'd MMM', { locale })}`
}

/**
 * Format price with currency
 */
export function formatBookingPrice(price, currency = 'THB', exchangeRates = {}) {
  if (!price) return '—'
  
  let convertedPrice = price
  if (currency !== 'THB' && exchangeRates[currency]) {
    convertedPrice = price / exchangeRates[currency]
  }
  
  const symbols = {
    THB: '฿',
    USD: '$',
    RUB: '₽',
    EUR: '€'
  }
  
  const symbol = symbols[currency] || currency
  
  return `${symbol}${Math.round(convertedPrice).toLocaleString()}`
}

/**
 * Get nights label with correct plural form
 */
export function getNightsLabel(nights, language = 'en') {
  if (language === 'ru') {
    if (nights === 1) return '1 ночь'
    if (nights >= 2 && nights <= 4) return `${nights} ночи`
    return `${nights} ночей`
  }
  
  return nights === 1 ? '1 night' : `${nights} nights`
}

/**
 * Build URL with booking parameters for context inheritance
 */
export function buildBookingUrl(baseUrl, params = {}) {
  const { checkIn, checkOut, guests } = params
  const url = new URL(baseUrl, 'http://dummy')
  
  if (checkIn) {
    const checkInStr = typeof checkIn === 'string' 
      ? checkIn 
      : format(checkIn, 'yyyy-MM-dd')
    url.searchParams.set('checkIn', checkInStr)
  }
  
  if (checkOut) {
    const checkOutStr = typeof checkOut === 'string' 
      ? checkOut 
      : format(checkOut, 'yyyy-MM-dd')
    url.searchParams.set('checkOut', checkOutStr)
  }
  
  if (guests && guests !== '1') {
    url.searchParams.set('guests', String(guests))
  }
  
  return `${url.pathname}${url.search}`
}

/**
 * Validate date range
 */
export function validateDateRange(checkIn, checkOut) {
  if (!checkIn || !checkOut) {
    return { valid: false, error: 'Dates required' }
  }
  
  const from = typeof checkIn === 'string' ? parseISO(checkIn) : checkIn
  const to = typeof checkOut === 'string' ? parseISO(checkOut) : checkOut
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  if (from < today) {
    return { valid: false, error: 'Check-in date is in the past' }
  }
  
  if (to <= from) {
    return { valid: false, error: 'Check-out must be after check-in' }
  }
  
  const nights = differenceInDays(to, from)
  if (nights > 365) {
    return { valid: false, error: 'Maximum stay is 365 nights' }
  }
  
  return { valid: true, nights }
}

/**
 * Calculate price breakdown
 */
export function calculatePriceBreakdown(basePricePerNight, nights, options = {}) {
  const {
    commissionRate = 0,
    serviceFeeRate = 3,
    cleaningFee = 0
  } = options
  
  const rental = basePricePerNight * nights
  const serviceFee = rental * (serviceFeeRate / 100)
  const commission = rental * (commissionRate / 100)
  const total = rental + serviceFee + commission + cleaningFee
  
  return {
    rental,
    serviceFee,
    serviceFeeRate,
    commission,
    commissionRate,
    cleaningFee,
    total,
    nights,
    perNight: basePricePerNight
  }
}
