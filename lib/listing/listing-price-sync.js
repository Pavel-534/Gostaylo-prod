/**
 * Sync listing price math (seasonal nights + duration discount + tax line inputs).
 * Client-safe — used by PDP hooks/widgets without pulling `pricing.service` / Supabase / currency.
 */

import { toListingDate, addListingDays } from '@/lib/listing-date'
import { applyDurationDiscountToSubtotal } from '@/lib/listing/duration-discount-tiers.js'

export function isTourCategorySlug(slug) {
  const s = String(slug || '').toLowerCase()
  return s === 'tours' || s.includes('tour')
}

function getSeasonTypeLabel(seasonType) {
  const labels = {
    LOW: 'Низкий сезон',
    NORMAL: 'Обычный',
    HIGH: 'Высокий сезон',
    PEAK: 'Пик сезона',
  }
  return labels[seasonType] || 'Season'
}

function parsePercent(raw, fallback = 0) {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(100, n)
}

/**
 * One night: DB `seasonal_prices` first, then metadata `seasonal_pricing` (aligned with CalendarService).
 */
export function calculateDailyPrice(basePrice, dateStr, seasonalPricing, dbSeasonalPrices = []) {
  let dailyPrice = basePrice
  let seasonLabel = 'Base'

  if (dbSeasonalPrices && dbSeasonalPrices.length > 0) {
    for (const season of dbSeasonalPrices) {
      const startDate = season.start_date
      const endDate = season.end_date
      if (dateStr >= startDate && dateStr <= endDate) {
        dailyPrice = Math.round(parseFloat(season.price_daily) || basePrice)
        seasonLabel = season.label || getSeasonTypeLabel(season.season_type)
        return { dailyPrice, seasonLabel }
      }
    }
  }

  if (seasonalPricing && seasonalPricing.length > 0) {
    for (const season of seasonalPricing) {
      const seasonStart = season.startDate || season.start_date
      const seasonEnd = season.endDate || season.end_date
      if (!seasonStart || !seasonEnd) continue

      if (dateStr >= seasonStart && dateStr <= seasonEnd) {
        const abs = season.priceDaily ?? season.price_daily
        if (abs != null && abs !== '' && !Number.isNaN(parseFloat(abs))) {
          dailyPrice = Math.round(parseFloat(abs))
          seasonLabel = season.label || season.name || season.seasonType || 'Season'
        } else {
          const multiplier = parseFloat(season.priceMultiplier) || 1.0
          dailyPrice = Math.round(basePrice * multiplier)
          seasonLabel = season.label || season.name || 'Season'
        }
        return { dailyPrice, seasonLabel }
      }
    }
  }

  return { dailyPrice, seasonLabel }
}

/**
 * Client-side calculation (no DB call) — real-time UI when listing + seasonal rows are already loaded.
 */
export function calculateBookingPriceSync(
  basePrice,
  checkIn,
  checkOut,
  seasonalPricing = [],
  dbSeasonalPrices = [],
  metadataForDiscounts = null,
  syncOptions = null,
) {
  const checkInStr = toListingDate(checkIn)
  const checkOutStr = toListingDate(checkOut)
  if (!checkInStr || !checkOutStr || checkInStr >= checkOutStr) {
    return { error: 'Invalid date range', nights: 0, totalPrice: 0 }
  }

  const opts = syncOptions && typeof syncOptions === 'object' ? syncOptions : {}
  const listingCategorySlug = String(opts.listingCategorySlug || '')
  const isTour = isTourCategorySlug(listingCategorySlug)
  const guestsCountRaw = Number(opts.guestsCount)
  const guestsCount = Math.max(1, Number.isFinite(guestsCountRaw) ? Math.floor(guestsCountRaw) : 1)

  let subtotal = 0
  const priceBreakdown = []
  const seasonSummary = {}
  let nights = 0

  let night = checkInStr
  while (night < checkOutStr) {
    const dateStr = night
    const { dailyPrice, seasonLabel } = calculateDailyPrice(
      basePrice,
      dateStr,
      seasonalPricing,
      dbSeasonalPrices,
    )

    subtotal += dailyPrice
    priceBreakdown.push({ date: dateStr, price: dailyPrice, season: seasonLabel })
    nights++

    if (!seasonSummary[seasonLabel]) {
      seasonSummary[seasonLabel] = { nights: 0, subtotal: 0, dailyRate: dailyPrice }
    }
    seasonSummary[seasonLabel].nights++
    seasonSummary[seasonLabel].subtotal += dailyPrice

    night = addListingDays(night, 1)
  }

  if (nights <= 0) {
    return { error: 'Invalid date range', nights: 0, totalPrice: 0 }
  }

  const dur = applyDurationDiscountToSubtotal(subtotal, nights, metadataForDiscounts)
  const partyMultiplier = isTour ? guestsCount : 1
  const totalOriginal = Math.round(dur.originalPrice * partyMultiplier)
  const totalDiscounted = Math.round(dur.discountedPrice * partyMultiplier)
  const totalDurationDiscountAmount = Math.round(dur.durationDiscountAmount * partyMultiplier)

  const taxRate = parsePercent(opts.taxRatePercent, 0)
  const taxAmountThb = Math.round(totalDiscounted * (taxRate / 100))

  return {
    nights,
    originalPrice: totalOriginal,
    discountedPrice: totalDiscounted,
    totalPrice: totalDiscounted,
    durationDiscountPercent: dur.durationDiscountPercent,
    durationDiscountAmount: totalDurationDiscountAmount,
    durationDiscountMinNights: dur.durationDiscountMinNights,
    durationDiscountSourceKey: dur.durationDiscountSourceKey,
    basePrice,
    averageNightlyRate: Math.round(subtotal / nights),
    averageNightlyAfterDiscount: Math.round(totalDiscounted / nights),
    priceBreakdown,
    seasonSummary,
    guestsCount,
    partyMultiplier,
    taxRate,
    taxAmountThb,
  }
}

/**
 * Wrapper for premium listing page / `hooks/pricing/useListingPricing` (matches legacy `PricingService.calculatePrice` shape).
 */
export function calculatePrice({
  basePriceThb,
  seasonalPricing,
  dbSeasonalPrices,
  metadata,
  checkIn,
  checkOut,
  currency: _currency = 'THB',
  exchangeRates: _exchangeRates = {},
  listingCategorySlug = '',
  guestsCount = 1,
  taxRatePercent = 0,
}) {
  const tr = Number(taxRatePercent)
  const taxOpt = Number.isFinite(tr) && tr >= 0 ? { taxRatePercent: tr } : { taxRatePercent: 0 }
  const calc = calculateBookingPriceSync(
    basePriceThb,
    checkIn,
    checkOut,
    seasonalPricing || [],
    dbSeasonalPrices || [],
    metadata || null,
    { listingCategorySlug, guestsCount, ...taxOpt },
  )

  if (calc.error) {
    return calc
  }

  let discountAmount = 0
  let surchargeAmount = 0

  if (calc.priceBreakdown) {
    calc.priceBreakdown.forEach((day) => {
      const diff = day.price - basePriceThb
      if (diff < 0) discountAmount += Math.abs(diff)
      if (diff > 0) surchargeAmount += diff
    })
  }

  return {
    nights: calc.nights,
    originalPrice: calc.originalPrice,
    discountedPrice: calc.discountedPrice,
    durationDiscountPercent: calc.durationDiscountPercent,
    durationDiscountAmount: calc.durationDiscountAmount,
    durationDiscountMinNights: calc.durationDiscountMinNights,
    durationDiscountSourceKey: calc.durationDiscountSourceKey,
    baseSubtotal: calc.originalPrice,
    avgPricePerNight: calc.averageNightlyRate,
    totalPrice: calc.totalPrice,
    discountAmount,
    surchargeAmount,
    priceBreakdown: calc.priceBreakdown,
    seasonSummary: calc.seasonSummary,
    taxRate: calc.taxRate ?? 0,
    taxAmountThb: calc.taxAmountThb ?? 0,
  }
}
