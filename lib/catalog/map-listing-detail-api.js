/**
 * Нормализация GET /api/v2/listings/[id] для PDP и TanStack Query prefetch.
 * @param {object} l — `data` из API
 */
export function mapListingDetailFromApi(l) {
  if (!l || typeof l !== 'object') return null

  const seasonalRaw = l.seasonalPrices || l.seasonalPricing || []
  const seasonalPricing = Array.isArray(seasonalRaw)
    ? seasonalRaw.map((sp) => ({
        startDate: sp.startDate || sp.start_date,
        endDate: sp.endDate || sp.end_date,
        priceDaily: sp.priceDaily ?? sp.price_daily,
        label: sp.label,
        seasonType: sp.seasonType || sp.season_type,
        name: sp.label,
        priceMultiplier: sp.priceMultiplier,
      }))
    : []
  const seasonalPricesRaw = l.seasonalPrices || []

  return {
    id: l.id,
    ownerId: l.ownerId ?? l.owner?.id ?? null,
    owner: l.owner,
    title: l.title,
    description: l.description,
    district: l.district,
    latitude: l.latitude,
    longitude: l.longitude,
    basePriceThb: parseFloat(l.basePriceThb),
    guestDisplayPriceThb: parseFloat(l.guestDisplayPriceThb) || 0,
    guestServiceFeePercent:
      l.guestServiceFeePercent != null ? Number(l.guestServiceFeePercent) : undefined,
    commissionRate: parseFloat(l.commissionRate),
    images: l.images || [],
    coverImage: l.coverImage,
    metadata: l.metadata || {},
    rating: parseFloat(l.rating) || 0,
    reviewsCount: l.reviewsCount || 0,
    seasonalPricing,
    dbSeasonalPrices: seasonalPricesRaw.map((sp) => ({
      start_date: String(sp.startDate || sp.start_date || '').slice(0, 10),
      end_date: String(sp.endDate || sp.end_date || '').slice(0, 10),
      price_daily: parseFloat(sp.priceDaily ?? sp.price_daily) || 0,
      label: sp.label,
      season_type: sp.seasonType || sp.season_type,
    })),
    minStay: l.minBookingDays || 1,
    city: l.city,
    category_id: l.categoryId,
    categorySlug: l.category?.slug || l.metadata?.category_slug || l.metadata?.categorySlug || null,
    wizardProfile: l.category?.wizard_profile || l.category?.wizardProfile || null,
    maxCapacity: (() => {
      const raw = l.maxCapacity ?? l.max_capacity
      const n = parseInt(raw, 10)
      return Number.isFinite(n) && n > 0 ? n : null
    })(),
    cancellationPolicy:
      l.cancellationPolicy ??
      l.cancellation_policy ??
      l.metadata?.cancellationPolicy ??
      l.metadata?.cancellation_policy ??
      'moderate',
    partnerTrust: l.partnerTrust ?? null,
    catalog_flash_urgency: l.catalog_flash_urgency ?? null,
    catalog_flash_social_proof: l.catalog_flash_social_proof ?? null,
  }
}
