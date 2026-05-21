/**
 * Stage 109.3 — map API listing → wizard formData (edit mode).
 */
import { clampIntFromDigits, sanitizeThbDigits } from '@/lib/listing-wizard-numeric'
import {
  normalizeWizardAmenities,
  filterAmenitiesForPartnerCategory,
} from '@/lib/listing-wizard-amenities'
import {
  partnerMetadataStateFromServer,
  mergeTourGroupMetadataFromListingColumns,
} from '@/lib/partner/listing-wizard-metadata'
import { isTourListingCategory } from '@/lib/listing-category-slug'
import { normalizeCategoryWizardProfileColumn } from '@/lib/config/category-wizard-profile-db'
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'
import { pickPartnerFormDescription } from '@/lib/partner/listing-description-i18n'
import { getDefaultWizardFormData } from '../wizard-constants'

/**
 * @param {object} listing — API row
 * @param {{ language: string, partnerCommissionRate: number|null, t: (k: string) => string }} ctx
 */
export function buildWizardFormDataFromListing(listing, { language, partnerCommissionRate, t }) {
  const c = listing.category || listing.categories
  const rawSeasonal = listing.seasonalPricing || listing.seasonalPrices || []
  const seasonal = rawSeasonal.map((s, i) => ({
    id: s.id || `s-${i}`,
    label: s.label || t('defaultListingSeasonLabel'),
    startDate: s.startDate || s.start_date,
    endDate: s.endDate || s.end_date,
    priceDaily: s.priceDaily ?? s.price_daily ?? 0,
    priceMonthly: s.priceMonthly ?? s.price_monthly ?? null,
    seasonType: s.seasonType || s.season_type || 'high',
  }))
  const rawMeta = listing.metadata || {}
  const shapedMeta = partnerMetadataStateFromServer(rawMeta)
  const catSlug = c?.slug || ''
  const tourCat =
    isTourListingCategory(catSlug) ||
    normalizeCategoryWizardProfileColumn(c?.wizard_profile ?? c?.wizardProfile) === 'tour'
  const metaForForm = tourCat
    ? mergeTourGroupMetadataFromListingColumns(
        shapedMeta,
        listing.minBookingDays ?? listing.min_booking_days,
        listing.maxBookingDays ?? listing.max_booking_days,
      )
    : shapedMeta
  const listingDesc = listing.description || ''
  const coverU = listing.coverImage || listing.cover_image
  const rawImgs = Array.isArray(listing.images) ? [...listing.images] : []
  let imagesOrdered = rawImgs
  if (coverU) {
    const idx = imagesOrdered.findIndex((u) => u === coverU)
    if (idx > 0) {
      const copy = [...imagesOrdered]
      const [first] = copy.splice(idx, 1)
      imagesOrdered = [first, ...copy]
    } else if (idx === -1) {
      imagesOrdered = [coverU, ...rawImgs]
    }
  }
  const inferredServiceType = inferListingServiceTypeFromCategorySlug(
    catSlug,
    c?.wizard_profile ?? c?.wizardProfile,
  )
  return {
    formData: {
      ...getDefaultWizardFormData(),
      listingServiceType: inferredServiceType,
      categoryId: listing.categoryId || listing.category_id || '',
      categoryName: c?.name || '',
      title: listing.title || '',
      description: pickPartnerFormDescription(language, listingDesc, rawMeta),
      district: listing.district || '',
      latitude: listing.latitude ?? null,
      longitude: listing.longitude ?? null,
      basePriceThb:
        sanitizeThbDigits((listing.basePriceThb ?? listing.base_price_thb)?.toString() || '') || '',
      baseCurrency:
        listing.baseCurrency || listing.base_currency || listing.metadata?.base_currency || 'THB',
      commissionRate: listing.commissionRate ?? listing.commission_rate ?? partnerCommissionRate,
      minBookingDays: tourCat
        ? 1
        : clampIntFromDigits(listing.minBookingDays ?? listing.min_booking_days ?? 1, 1, 365, 1),
      maxBookingDays: tourCat
        ? 730
        : clampIntFromDigits(listing.maxBookingDays ?? listing.max_booking_days ?? 90, 1, 730, 90),
      images: imagesOrdered,
      coverImage: coverU || imagesOrdered[0] || '',
      cancellationPolicy: listing.cancellationPolicy || listing.cancellation_policy || 'moderate',
      status: listing.status,
      available: Boolean(listing.available),
      metadata: {
        ...getDefaultWizardFormData().metadata,
        ...metaForForm,
        bedrooms: clampIntFromDigits(metaForForm.bedrooms ?? 0, 0, 99, 0),
        bathrooms: clampIntFromDigits(metaForForm.bathrooms ?? 0, 0, 99, 0),
        max_guests: clampIntFromDigits(metaForForm.max_guests ?? 2, 1, 999, 1),
        area: clampIntFromDigits(metaForForm.area ?? 0, 0, 9_999_999, 0),
        passengers: clampIntFromDigits(metaForForm.passengers ?? rawMeta.passengers ?? 0, 0, 999, 0),
        amenities: filterAmenitiesForPartnerCategory(
          c?.slug || '',
          normalizeWizardAmenities(rawMeta.amenities || []),
        ),
        languages: Array.isArray(metaForForm.languages) ? metaForForm.languages : [],
        experience_years: metaForForm.experience_years ?? '',
        transmission: metaForForm.transmission ?? '',
        fuel_type: metaForForm.fuel_type ?? '',
        engine_cc: metaForForm.engine_cc ?? '',
        vehicle_year: metaForForm.vehicle_year ?? '',
        seats: metaForForm.seats ?? '',
        specialization: metaForForm.specialization ?? '',
        group_size_min: clampIntFromDigits(metaForForm.group_size_min ?? 1, 1, 999, 1),
        group_size_max: clampIntFromDigits(
          metaForForm.group_size_max ?? Math.max(metaForForm.group_size_min ?? 1, 10),
          1,
          999,
          Math.max(clampIntFromDigits(metaForForm.group_size_min ?? 1, 1, 999, 1), 10),
        ),
      },
      seasonalPricing: seasonal || listing.seasonalPricing || listing.seasonalPrices || [],
    },
    serverListing: listing,
  }
}
