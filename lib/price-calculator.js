// Price Calculator for Gostaylo
// Handles seasonal pricing with weighted average calculation

/**
 * Calculate the total price and breakdown for a booking period
 * considering seasonal price ranges
 * 
 * @param {string} listingId - The listing ID
 * @param {string} checkIn - Check-in date (YYYY-MM-DD)
 * @param {string} checkOut - Check-out date (YYYY-MM-DD)
 * @param {number} basePriceThb - Base daily price of listing
 * @param {Array} seasonalPrices - Array of seasonal price objects
 * @param {boolean} isMonthly - Is this a monthly booking (30+ days)
 * 
 * @returns {Object} { totalPrice, breakdown, averageDaily, isSeasonalApplied }
 */
export function calculateSeasonalPrice(
  listingId,
  checkIn,
  checkOut,
  basePriceThb,
  seasonalPrices = [],
  isMonthly = false
) {
  const checkInDate = new Date(checkIn)
  const checkOutDate = new Date(checkOut)
  
  // Calculate number of days
  const msPerDay = 1000 * 60 * 60 * 24
  const totalDays = Math.ceil((checkOutDate - checkInDate) / msPerDay)
  
  if (totalDays <= 0) {
    return {
      totalPrice: 0,
      breakdown: [],
      averageDaily: 0,
      isSeasonalApplied: false,
      error: 'Invalid date range',
    }
  }
  
  // If monthly booking (30+ days), try to use monthly rates
  if (isMonthly && totalDays >= 30) {
    const monthlyResult = calculateMonthlyPrice(
      checkInDate,
      checkOutDate,
      totalDays,
      basePriceThb,
      seasonalPrices
    )
    if (monthlyResult) {
      return monthlyResult
    }
  }
  
  // Daily calculation with weighted average
  const breakdown = []
  let currentDate = new Date(checkInDate)
  let totalPrice = 0
  let hasSeasonalPrice = false
  
  // For each day in the booking range
  for (let i = 0; i < totalDays; i++) {
    const dateStr = currentDate.toISOString().split('T')[0]
    
    // Find applicable seasonal price for this date
    const applicableSeason = findApplicableSeasonalPrice(
      currentDate,
      seasonalPrices
    )
    
    let dayPrice = basePriceThb
    let seasonLabel = 'Базовая цена'
    let seasonType = 'NORMAL'
    
    if (applicableSeason) {
      dayPrice = applicableSeason.priceDaily
      seasonLabel = applicableSeason.label
      seasonType = applicableSeason.seasonType
      hasSeasonalPrice = true
    }
    
    // Group consecutive days with same price
    const lastBreakdown = breakdown[breakdown.length - 1]
    if (lastBreakdown && lastBreakdown.priceDaily === dayPrice && lastBreakdown.seasonLabel === seasonLabel) {
      // Extend existing range
      lastBreakdown.days += 1
      lastBreakdown.endDate = dateStr
      lastBreakdown.subtotal += dayPrice
    } else {
      // Create new breakdown entry
      breakdown.push({
        startDate: dateStr,
        endDate: dateStr,
        days: 1,
        priceDaily: dayPrice,
        seasonLabel,
        seasonType,
        subtotal: dayPrice,
      })
    }
    
    totalPrice += dayPrice
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return {
    totalPrice,
    breakdown,
    averageDaily: totalPrice / totalDays,
    totalDays,
    isSeasonalApplied: hasSeasonalPrice,
  }
}

/**
 * Find applicable seasonal price for a specific date
 */
function findApplicableSeasonalPrice(date, seasonalPrices) {
  if (!seasonalPrices || seasonalPrices.length === 0) {
    return null
  }
  
  for (const season of seasonalPrices) {
    const startDate = new Date(season.startDate)
    const endDate = new Date(season.endDate)
    
    // Check if date falls within this seasonal range
    if (date >= startDate && date <= endDate) {
      return season
    }
  }
  
  return null
}

/**
 * Calculate monthly price if applicable
 * Uses priceMonthly if available and booking is 30+ days
 */
function calculateMonthlyPrice(
  checkInDate,
  checkOutDate,
  totalDays,
  basePriceThb,
  seasonalPrices
) {
  // Find if entire period falls within one seasonal range with monthly price
  const applicableSeason = seasonalPrices.find(season => {
    const start = new Date(season.startDate)
    const end = new Date(season.endDate)
    return (
      checkInDate >= start &&
      checkOutDate <= end &&
      season.priceMonthly
    )
  })
  
  if (applicableSeason && applicableSeason.priceMonthly) {
    // Use monthly rate
    const fullMonths = Math.floor(totalDays / 30)
    const remainingDays = totalDays % 30
    
    const totalPrice =
      fullMonths * applicableSeason.priceMonthly +
      remainingDays * applicableSeason.priceDaily
    
    return {
      totalPrice,
      breakdown: [
        {
          startDate: checkInDate.toISOString().split('T')[0],
          endDate: checkOutDate.toISOString().split('T')[0],
          days: totalDays,
          priceDaily: applicableSeason.priceDaily,
          priceMonthly: applicableSeason.priceMonthly,
          seasonLabel: applicableSeason.label,
          seasonType: applicableSeason.seasonType,
          subtotal: totalPrice,
          isMonthly: true,
          fullMonths,
          remainingDays,
        },
      ],
      averageDaily: totalPrice / totalDays,
      totalDays,
      isSeasonalApplied: true,
      isMonthlyRate: true,
    }
  }
  
  return null
}

/**
 * Validate seasonal price ranges - check for overlaps
 * 
 * @param {Array} existingRanges - Existing seasonal prices for listing
 * @param {string} newStartDate - New range start date
 * @param {string} newEndDate - New range end date
 * @param {string} excludeId - ID to exclude from validation (for updates)
 * 
 * @returns {Object} { valid: boolean, error?: string }
 */
export function validateSeasonalRange(
  existingRanges,
  newStartDate,
  newEndDate,
  excludeId = null
) {
  const newStart = new Date(newStartDate)
  const newEnd = new Date(newEndDate)
  
  // Basic validation
  if (newStart >= newEnd) {
    return {
      valid: false,
      error: 'Дата начала должна быть раньше даты окончания',
    }
  }
  
  // Check for overlaps with existing ranges
  for (const range of existingRanges) {
    if (excludeId && range.id === excludeId) {
      continue // Skip this range when updating
    }
    
    const existingStart = new Date(range.startDate)
    const existingEnd = new Date(range.endDate)
    
    // Check if ranges overlap
    const overlaps =
      (newStart >= existingStart && newStart <= existingEnd) || // New start within existing
      (newEnd >= existingStart && newEnd <= existingEnd) || // New end within existing
      (newStart <= existingStart && newEnd >= existingEnd) // New range contains existing
    
    if (overlaps) {
      return {
        valid: false,
        error: `Этот диапазон дат пересекается с сезоном "${range.label}" (${range.startDate} - ${range.endDate})`,
        conflictingRange: range,
      }
    }
  }
  
  return { valid: true }
}

/**
 * Get color coding for season type
 */
export function getSeasonColor(seasonType) {
  const colors = {
    LOW: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', label: 'Низкий' },
    NORMAL: { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300', label: 'Обычный' },
    HIGH: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', label: 'Высокий' },
    PEAK: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'Пик' },
  }
  
  return colors[seasonType] || colors.NORMAL
}

/**
 * Format price breakdown for display
 */
export function formatPriceBreakdown(breakdown) {
  return breakdown.map(item => {
    const dateRange = item.startDate === item.endDate
      ? item.startDate
      : `${item.startDate} — ${item.endDate}`
    
    if (item.isMonthly) {
      return {
        label: `${item.fullMonths} мес. × ${item.priceMonthly?.toLocaleString('ru-RU')} ₿ + ${item.remainingDays} дней × ${item.priceDaily?.toLocaleString('ru-RU')} ₿`,
        amount: item.subtotal,
        seasonLabel: item.seasonLabel,
        seasonType: item.seasonType,
      }
    }
    
    return {
      label: `${item.days} ${getDaysLabel(item.days)} × ${item.priceDaily?.toLocaleString('ru-RU')} ₿`,
      sublabel: `${item.seasonLabel} (${dateRange})`,
      amount: item.subtotal,
      seasonLabel: item.seasonLabel,
      seasonType: item.seasonType,
    }
  })
}

function getDaysLabel(days) {
  if (days === 1) return 'день'
  if (days >= 2 && days <= 4) return 'дня'
  return 'дней'
}
