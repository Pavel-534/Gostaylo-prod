import { supabaseAdmin } from '@/lib/supabase'
import { toListingDate, addListingDays } from '@/lib/listing-date'
import { applyDurationDiscountToSubtotal } from '@/lib/listing/duration-discount-tiers.js'
import {
  calculateDailyPrice as syncCalculateDailyPrice,
  calculateBookingPriceSync as syncCalculateBookingPriceSync,
  calculatePrice as syncCalculateListingPrice,
  isTourCategorySlug,
} from '@/lib/listing/listing-price-sync.js'
import { getGeneralPricingSettings, parsePercent } from '@/lib/services/pricing/pricing-fee-policy.js'

export { applyDurationDiscountToSubtotal }

export async function getListingWithSeasonalPricing(listingId) {
  const [{ data: listing, error }, { data: dbSeasonal }] = await Promise.all([
    supabaseAdmin.from('listings').select('id, base_price_thb, metadata').eq('id', listingId).single(),
    supabaseAdmin
      .from('seasonal_prices')
      .select('*')
      .eq('listing_id', listingId)
      .order('start_date', { ascending: true }),
  ])

  if (error || !listing) return null
  return {
    id: listing.id,
    basePrice: parseFloat(listing.base_price_thb),
    dbSeasonalPrices: dbSeasonal || [],
    seasonalPricing: listing.metadata?.seasonal_pricing || [],
    metadata: listing.metadata || {},
  }
}

export async function getSeasonalPrice(listingId, checkIn, checkOut) {
  const listing = await getListingWithSeasonalPricing(listingId)
  if (!listing) return []

  const checkInDate = new Date(checkIn)
  const checkOutDate = new Date(checkOut)

  const fromDb = (listing.dbSeasonalPrices || []).filter((season) => {
    const seasonStart = new Date(season.start_date)
    const seasonEnd = new Date(season.end_date)
    return seasonStart <= checkOutDate && seasonEnd >= checkInDate
  })
  const fromMeta = (listing.seasonalPricing || []).filter((season) => {
    const seasonStart = new Date(season.startDate || season.start_date)
    const seasonEnd = new Date(season.endDate || season.end_date)
    return seasonStart <= checkOutDate && seasonEnd >= checkInDate
  })
  return [...fromDb, ...fromMeta]
}

export function calculateDailyPrice(basePrice, dateStr, seasonalPricing, dbSeasonalPrices = []) {
  return syncCalculateDailyPrice(basePrice, dateStr, seasonalPricing, dbSeasonalPrices)
}

export async function calculateBookingPrice(listingId, checkIn, checkOut, basePriceOverride = null, options = {}) {
  const checkInStr = toListingDate(checkIn)
  const checkOutStr = toListingDate(checkOut)
  if (!checkInStr || !checkOutStr || checkInStr >= checkOutStr) {
    return { error: 'Invalid date range', nights: 0, totalPrice: 0 }
  }

  const listing = await getListingWithSeasonalPricing(listingId)
  if (!listing) return { error: 'Listing not found', nights: 0, totalPrice: 0 }

  const listingCategorySlug = String(options?.listingCategorySlug || '')
  const isTour = isTourCategorySlug(listingCategorySlug)
  const guestsCountRaw = Number(options?.guestsCount)
  const guestsCount = Math.max(1, Number.isFinite(guestsCountRaw) ? Math.floor(guestsCountRaw) : 1)
  if (isTour && guestsCount < 1) {
    return { error: 'Tours require guestsCount >= 1', nights: 0, totalPrice: 0 }
  }

  const basePrice = basePriceOverride || listing.basePrice
  const seasonalPricing = listing.seasonalPricing
  const dbSeasonalPrices = listing.dbSeasonalPrices || []

  let subtotalBeforeDuration = 0
  const priceBreakdown = []
  const seasonSummary = {}
  let nights = 0

  let night = checkInStr
  while (night < checkOutStr) {
    const dateStr = night
    const { dailyPrice, seasonLabel } = syncCalculateDailyPrice(basePrice, dateStr, seasonalPricing, dbSeasonalPrices)
    subtotalBeforeDuration += dailyPrice
    priceBreakdown.push({ date: dateStr, price: dailyPrice, season: seasonLabel })
    nights++

    if (!seasonSummary[seasonLabel]) {
      seasonSummary[seasonLabel] = { nights: 0, subtotal: 0, dailyRate: dailyPrice }
    }
    seasonSummary[seasonLabel].nights++
    seasonSummary[seasonLabel].subtotal += dailyPrice
    night = addListingDays(night, 1)
  }

  if (nights <= 0) return { error: 'Invalid date range', nights: 0, totalPrice: 0 }

  const dur = applyDurationDiscountToSubtotal(subtotalBeforeDuration, nights, listing.metadata)
  const partyMultiplier = isTour ? guestsCount : 1
  const totalOriginal = Math.round(dur.originalPrice * partyMultiplier)
  const totalDiscounted = Math.round(dur.discountedPrice * partyMultiplier)
  const totalDurationDiscountAmount = Math.round(dur.durationDiscountAmount * partyMultiplier)

  const generalTax = await getGeneralPricingSettings()
  const taxRate = parsePercent(generalTax?.taxRatePercent, 0)
  const taxAmountThb = Math.round(totalDiscounted * (taxRate / 100))

  return {
    nights,
    originalPrice: totalOriginal,
    discountedPrice: totalDiscounted,
    totalPrice: totalDiscounted,
    durationDiscountPercent: dur.durationDiscountPercent,
    durationDiscountAmount: totalDurationDiscountAmount,
    durationDiscountTiers: dur.durationDiscountTiers,
    durationDiscountMinNights: dur.durationDiscountMinNights,
    durationDiscountSourceKey: dur.durationDiscountSourceKey,
    guestsCount,
    partyMultiplier,
    basePrice,
    averageNightlyRate: Math.round(subtotalBeforeDuration / nights),
    averageNightlyAfterDiscount: Math.round(totalDiscounted / nights),
    priceBreakdown,
    seasonSummary,
    taxRate,
    taxAmountThb,
  }
}

export function calculateBookingPriceSync(
  basePrice,
  checkIn,
  checkOut,
  seasonalPricing = [],
  dbSeasonalPrices = [],
  metadataForDiscounts = null,
  syncOptions = null,
) {
  return syncCalculateBookingPriceSync(
    basePrice,
    checkIn,
    checkOut,
    seasonalPricing,
    dbSeasonalPrices,
    metadataForDiscounts,
    syncOptions,
  )
}

export function calculatePrice(opts) {
  return syncCalculateListingPrice(opts)
}
