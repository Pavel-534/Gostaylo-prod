/**
 * Maps external platform payload → columns for `public.listings` (Supabase insert/patch).
 * Does not perform network I/O; safe to run in API routes or scripts.
 */

import type {
  ExternalImportPlatform,
  ExternalListingPayload,
  ListingAmenitiesBlock,
  ListingCategorySpecific,
  ListingMetadata,
  ListingPropertyInfo,
  ListingRules,
  ListingSyncSettings,
} from '@/lib/types/listing-metadata'
import {
  buildImportSeoMeta,
  descriptionImpliesWorkationReady,
  nearestPhuketDistrictName,
  type ImportSeoLocales,
} from '@/lib/listings/airbnb-import-enrichment'

export interface MapExternalOptions {
  /** UUID владельца (обязателен для insert через API) */
  ownerId: string
  /** UUID категории в Gostaylo */
  categoryId: string
  /** Если цена пришла не в THB — задайте курс или конвертацию снаружи */
  basePriceThbFallback?: number
}

export interface MappedListingRow {
  owner_id: string
  category_id: string
  title: string
  description: string | null
  district: string | null
  base_price_thb: number
  latitude: number | null
  longitude: number | null
  images: string[]
  cover_image: string | null
  metadata: ListingMetadata
  sync_settings: ListingSyncSettings
  import_platform: string
  import_external_id: string | null
  import_external_url: string | null
  last_imported_at: string
  /** Черновик импорта: на модерации / не в каталоге до проверки партнёром */
  status: 'PENDING' | 'INACTIVE'
  available: boolean
  commission_rate: number
}

export interface MapExternalResult {
  row: MappedListingRow
  warnings: string[]
}

function str(v: unknown): string | null {
  if (v == null) return null
  if (typeof v === 'string') return v.trim() || null
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return null
}

function num(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  return Number.isFinite(n) ? n : null
}

function bool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v
  if (v === 'true' || v === 1 || v === '1') return true
  if (v === 'false' || v === 0 || v === '0') return false
  return null
}

function pickStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x).trim()).filter(Boolean)
}

/** Безопасный доступ к вложенным объектам из Record<string, unknown> */
function asRecord(v: unknown): Record<string, unknown> | null {
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>
  }
  return null
}

/**
 * Нормализация «псевдо-Airbnb» JSON (поля именованы гипотетически; подстроите под реальный парсер).
 */
function mapAirbnbLike(raw: ExternalListingPayload, warnings: string[]): Partial<MappedListingRow> {
  const title = str(raw.name ?? raw.title ?? raw.listing_title)
  const descLangs = raw.description_languages
  const descLang0 = Array.isArray(descLangs) ? descLangs[0] : null
  const description = str(raw.description ?? raw.summary ?? descLang0)

  const loc = asRecord(raw.location)
  const city = str(raw.city ?? (loc ? loc.city : null))
  const district = str(raw.neighborhood ?? raw.district ?? (loc ? loc.neighborhood : null) ?? city)

  const lat = num(raw.lat ?? raw.latitude ?? (loc ? loc.lat : null))
  const lng = num(raw.lng ?? raw.lon ?? raw.longitude ?? (loc ? loc.lng : null))

  const pricing = asRecord(raw.pricing)
  let base = num(raw.price ?? raw.nightly_price ?? (pricing ? pricing.base_price : null))
  if (base == null) {
    warnings.push('airbnb: missing price, using 0 (set basePriceThbFallback in options)')
    base = 0
  }

  // Currency check: Airbnb sometimes returns USD/EUR/other depending on scraper locale
  const rawCurrency = str(
    raw.currency ??
    raw.price_currency ??
    raw.priceCurrency ??
    (pricing ? pricing.currency ?? pricing.currencyCode : null)
  )
  if (rawCurrency && rawCurrency.toUpperCase() !== 'THB') {
    warnings.push(
      `Цена импортирована в ${rawCurrency.toUpperCase()}, пожалуйста, проверьте конвертацию в THB`
    )
  }

  const extId = str(raw.id ?? raw.listing_id ?? raw.room_id)

  const photos = Array.isArray(raw.pictures)
    ? (raw.pictures as unknown[])
        .map((p) => {
          if (typeof p === 'string') return p
          if (p && typeof p === 'object' && 'url' in p) return str((p as { url: unknown }).url)
          return null
        })
        .filter(Boolean) as string[]
    : pickStringArray(raw.image_urls)

  const property_info: ListingPropertyInfo = {
    bedrooms: num(raw.bedrooms ?? raw.bedroom_count),
    beds: num(raw.beds ?? raw.bed_count),
    bathrooms: num(raw.bathrooms ?? raw.bathroom_count),
    square_meters: num(raw.area_sqm ?? raw.square_meters),
    max_guests: num(raw.person_capacity ?? raw.guests_max ?? raw.accommodates),
  }

  const amenities: ListingAmenitiesBlock = {
    codes: pickStringArray(raw.amenity_codes ?? raw.amenities),
    labels: pickStringArray(raw.amenity_names),
  }

  const rules: ListingRules = {
    check_in_from: str(raw.check_in_time ?? raw.check_in_from),
    check_out_until: str(raw.check_out_time ?? raw.check_out_until),
    pets_allowed: bool(raw.pets_allowed ?? raw.allow_pets),
    smoking_allowed: bool(raw.smoking_allowed),
  }

  const category_specific: ListingCategorySpecific = {}

  return {
    title: title || 'Imported listing',
    description,
    district,
    base_price_thb: base,
    latitude: lat,
    longitude: lng,
    images: photos,
    cover_image: photos[0] ?? null,
    import_external_id: extId,
    import_external_url: str(raw.listing_url ?? raw.url),
    metadata: {
      metadata_schema_version: 1,
      import_draft: true,
      property_info,
      amenities,
      rules,
      category_specific,
      // legacy flat keys used elsewhere in app
      city: city || undefined,
      bedrooms: property_info.bedrooms ?? undefined,
      bathrooms: property_info.bathrooms ?? undefined,
      max_guests: property_info.max_guests ?? undefined,
      area: property_info.square_meters ?? undefined,
    },
  }
}

/**
 * Нормализация «псевдо-Booking» JSON.
 */
function mapBookingLike(raw: ExternalListingPayload, warnings: string[]): Partial<MappedListingRow> {
  const title = str(raw.property_name ?? raw.name ?? raw.title)
  const description = str(raw.description ?? raw.long_description)

  const address = asRecord(raw.address)
  const district = str(raw.city_name ?? (address ? address.city : null))

  const geo = asRecord(raw.geo)
  const lat = num(raw.latitude ?? (geo ? geo.latitude : null))
  const lng = num(raw.longitude ?? (geo ? geo.longitude : null))

  const rates = asRecord(raw.rates)
  let base = num(raw.price_amount ?? raw.min_rate ?? (rates ? rates.nightly : null))
  if (base == null) {
    warnings.push('booking: missing price, using 0 (set basePriceThbFallback in options)')
    base = 0
  }

  const extId = str(raw.hotel_id ?? raw.property_id ?? raw.id)

  const photos: string[] = Array.isArray(raw.photos)
    ? (raw.photos as unknown[])
        .map((p) => (typeof p === 'string' ? p : p && typeof p === 'object' && 'url' in p ? str((p as { url: unknown }).url) : null))
        .filter(Boolean) as string[]
    : []

  const property_info: ListingPropertyInfo = {
    max_guests: num(raw.max_persons ?? raw.max_guests),
  }

  return {
    title: title || 'Imported listing',
    description,
    district,
    base_price_thb: base,
    latitude: lat,
    longitude: lng,
    images: photos,
    cover_image: photos[0] ?? null,
    import_external_id: extId,
    import_external_url: str(raw.url ?? raw.booking_url),
    metadata: {
      metadata_schema_version: 1,
      import_draft: true,
      property_info,
      amenities: { codes: pickStringArray(raw.facilities), labels: pickStringArray(raw.facility_names) },
      rules: {
        check_in_from: str(raw.checkin_from),
        check_out_until: str(raw.checkout_until),
      },
      category_specific: {},
      city: district || undefined,
      max_guests: property_info.max_guests ?? undefined,
    },
  }
}

function mapGeneric(raw: ExternalListingPayload, warnings: string[]): Partial<MappedListingRow> {
  warnings.push('platform "other": using generic field guesses')
  return mapAirbnbLike(raw, warnings)
}

/**
 * @param externalData — сырой JSON (парсер, PMS webhook, CSV row → object)
 * @param platform — источник маппинга
 */
export function mapExternalToInternal(
  externalData: ExternalListingPayload,
  platform: ExternalImportPlatform,
  options: MapExternalOptions
): MapExternalResult {
  const warnings: string[] = []
  const now = new Date().toISOString()

  let partial: Partial<MappedListingRow>
  switch (platform) {
    case 'airbnb':
      partial = mapAirbnbLike(externalData, warnings)
      break
    case 'booking':
      partial = mapBookingLike(externalData, warnings)
      break
    case 'vrbo':
      partial = mapAirbnbLike(externalData, warnings)
      warnings.push('vrbo: using airbnb-like mapper; refine fields when parser is ready')
      break
    default:
      partial = mapGeneric(externalData, warnings)
      break
  }

  const fallbackPrice = options.basePriceThbFallback ?? 0
  const price = partial.base_price_thb != null && partial.base_price_thb > 0 ? partial.base_price_thb : fallbackPrice
  if (price === 0) warnings.push('base_price_thb is 0 — set manually before publish')

  if (platform === 'airbnb') {
    const geoDistrict = nearestPhuketDistrictName(partial.latitude ?? null, partial.longitude ?? null)
    if (geoDistrict) {
      partial.district = geoDistrict
    }
    const districtForSeo = partial.district ?? null
    const amenBlock = partial.metadata?.amenities as ListingAmenitiesBlock | undefined
    const amenityLabels = Array.isArray(amenBlock?.labels) ? amenBlock.labels.map(String) : []
    const { seo } = buildImportSeoMeta({
      title: partial.title || 'Imported listing',
      district: districtForSeo,
      description: partial.description ?? null,
      amenityLabels,
    })
    partial.metadata = {
      ...(partial.metadata || {}),
      seo,
      ...(descriptionImpliesWorkationReady(partial.description) ? { is_workation_ready: true } : {}),
    }
  }

  const metadata = { ...(partial.metadata || {}) } as ListingMetadata
  const sync_settings: ListingSyncSettings = {
    platform,
    external_listing_id: partial.import_external_id || undefined,
    external_listing_url: partial.import_external_url || undefined,
    last_import_at: now,
    last_sync_status: warnings.length ? 'partial' : 'ok',
    field_mapping_version: 1,
    last_error_messages: warnings.length ? warnings : undefined,
  }

  const row: MappedListingRow = {
    owner_id: options.ownerId,
    category_id: options.categoryId,
    title: partial.title || 'Imported listing',
    description: partial.description ?? null,
    district: partial.district ?? null,
    base_price_thb: price,
    latitude: partial.latitude ?? null,
    longitude: partial.longitude ?? null,
    images: partial.images || [],
    cover_image: partial.cover_image ?? null,
    metadata,
    sync_settings,
    import_platform: platform,
    import_external_id: partial.import_external_id ?? null,
    import_external_url: partial.import_external_url ?? null,
    last_imported_at: now,
    status: 'PENDING',
    available: false,
    commission_rate: 15,
  }

  return { row, warnings }
}
