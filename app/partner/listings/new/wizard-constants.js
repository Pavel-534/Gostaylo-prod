export { PHUKET_DISTRICTS_CANON as WIZARD_DISTRICTS } from '@/lib/locations/phuket-districts-canonical'

export function getDefaultWizardFormData() {
  return {
    /** @type {'' | 'stay' | 'transport' | 'service' | 'tour'} Stage 26.0 */
    listingServiceType: '',
    categoryId: '',
    categoryName: '',
    title: '',
    description: '',
    /** Stage GP-1 (Global Pivot 2026-02) — иерархия адреса для глобального агрегатора */
    country: 'TH',     // ISO 3166-1 alpha-2; default Thailand для backward-compat
    region: 'TH-PHK',  // ISO 3166-2-like; default Phuket
    city: 'phuket-city',
    district: '',
    latitude: null,
    longitude: null,
    basePriceThb: '',
    baseCurrency: 'THB',
    commissionRate: '',
    minBookingDays: 1,
    maxBookingDays: 90,
    images: [],
    coverImage: '',
    metadata: {
      /** Жильё/транспорт подставляются при выборе типа и категории (`defaultMetadataForListingServiceType`, `setCategoryId`). */
      amenities: [],
      passengers: 0,
      engine: '',
      duration: '',
      includes: [],
      transmission: '',
      fuel_type: '',
      engine_cc: '',
      vehicle_year: '',
      seats: '',
      languages: [],
      experience_years: '',
      specialization: '',
      group_size_min: 1,
      group_size_max: 10,
      /** IANA TZ for quiet hours / SLA (Stage 21.0); saved in listings.metadata */
      timezone: 'Asia/Bangkok',
      /** Stage 30.0 — копируется в booking.metadata при создании брони */
      check_in_instructions: '',
      /** Stage 31.0 — до 3 URL, копируются в booking.metadata как `check_in_photos` */
      check_in_photos: [],
      /** Stage 30.0 — `full_to_full` скрывает подсказку «топливо не включено» в чеке */
      fuel_policy: '',
    },
    seasonalPricing: [],
    cancellationPolicy: 'moderate',
    status: 'INACTIVE',
    available: false,
  }
}
