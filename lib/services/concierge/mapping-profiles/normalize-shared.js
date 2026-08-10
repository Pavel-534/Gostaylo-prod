/**
 * Shared normalization helpers for Concierge mapping profiles (ADR-210 Slice 6).
 * No fee/FX hardcodes — foreign currency needs explicit rateToThb in opts or payload.
 */

import { filterConciergeImagesWithDriveGuard } from '@/lib/services/concierge/concierge-media.service.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Common amenity aliases → metadata boolean keys */
const AMENITY_ALIASES = {
  wifi: 'wifi',
  wi_fi: 'wifi',
  'wi-fi': 'wifi',
  интернет: 'wifi',
  pool: 'pool',
  бассейн: 'pool',
  parking: 'parking',
  парковка: 'parking',
  ac: 'air_conditioning',
  'air conditioning': 'air_conditioning',
  кондиционер: 'air_conditioning',
  kitchen: 'kitchen',
  кухня: 'kitchen',
  washer: 'washer',
  стиральная: 'washer',
  gym: 'gym',
  спортзал: 'gym',
  sea_view: 'sea_view',
  'sea view': 'sea_view',
  вид_на_море: 'sea_view',
}

export function isIsoDate(value) {
  return ISO_DATE.test(String(value || '').trim())
}

export function parseIsoDateMs(value) {
  const s = String(value || '').trim()
  if (!ISO_DATE.test(s)) return NaN
  return Date.parse(`${s}T00:00:00.000Z`)
}

/**
 * Normalize season rows: ISO dates, priceDaily > 0, start <= end.
 * @param {unknown} seasons
 * @param {string} externalId
 */
export function normalizeSeasons(seasons, externalId) {
  const warnings = []
  const out = []
  if (!Array.isArray(seasons) || seasons.length === 0) {
    return { ok: true, seasons: out, warnings }
  }

  for (let i = 0; i < seasons.length; i += 1) {
    const s = seasons[i] || {}
    const startDate = String(s.startDate || s.start || '').trim()
    const endDate = String(s.endDate || s.end || '').trim()
    const priceDaily = Number(s.priceDaily ?? s.daily ?? s.price_thb ?? s.price)
    const label = s.label != null ? String(s.label).trim() : null
    const seasonType = s.seasonType != null ? String(s.seasonType).trim().toLowerCase() : null

    if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
      return {
        ok: false,
        error: `Некорректные даты сезона #${i + 1} у объекта ${externalId} (нужен YYYY-MM-DD)`,
        code: 'INVALID_SEASON_DATES',
        field: `seasons[${i}]`,
      }
    }
    const startMs = parseIsoDateMs(startDate)
    const endMs = parseIsoDateMs(endDate)
    if (!(startMs <= endMs)) {
      return {
        ok: false,
        error: `Дата начала сезона позже конца у объекта ${externalId} (${startDate} > ${endDate})`,
        code: 'SEASON_DATE_ORDER',
        field: `seasons[${i}]`,
      }
    }
    if (!Number.isFinite(priceDaily) || priceDaily <= 0) {
      return {
        ok: false,
        error: `Отсутствует или неверна суточная цена сезона #${i + 1} у объекта ${externalId}`,
        code: 'INVALID_SEASON_PRICE',
        field: `seasons[${i}].priceDaily`,
      }
    }

    const row = {
      startDate,
      endDate,
      priceDaily,
      ...(s.priceMonthly != null && Number.isFinite(Number(s.priceMonthly))
        ? { priceMonthly: Number(s.priceMonthly) }
        : {}),
      ...(label ? { label } : {}),
      ...(seasonType ? { seasonType } : {}),
    }
    out.push(row)
  }

  return { ok: true, seasons: out, warnings }
}

/**
 * Resolve THB amount from basePriceThb or amount+currency (+ rateToThb).
 * @param {object} raw
 * @param {{ rateToThb?: Record<string, number> }} [opts]
 */
export function resolveBasePriceThb(raw, opts = {}) {
  const direct = Number(raw?.basePriceThb ?? raw?.base_price_thb)
  if (Number.isFinite(direct) && direct > 0) {
    return { ok: true, basePriceThb: direct, warnings: [] }
  }

  const amount = Number(raw?.price ?? raw?.amount ?? raw?.basePrice)
  const currency = String(raw?.currency || raw?.baseCurrency || 'THB')
    .trim()
    .toUpperCase() || 'THB'

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      ok: false,
      error: 'basePriceThb must be > 0',
      code: 'MISSING_BASE_PRICE',
      field: 'basePriceThb',
    }
  }

  if (currency === 'THB') {
    return { ok: true, basePriceThb: amount, warnings: [] }
  }

  const rates = opts.rateToThb && typeof opts.rateToThb === 'object' ? opts.rateToThb : {}
  const payloadRate = Number(raw?.thbPerUnit ?? raw?.rateToThb)
  const rate = Number.isFinite(payloadRate) && payloadRate > 0 ? payloadRate : Number(rates[currency])

  if (!Number.isFinite(rate) || rate <= 0) {
    return {
      ok: false,
      error: `Валюта ${currency} не конвертирована в THB: укажите basePriceThb или thbPerUnit / opts.rateToThb.${currency}`,
      code: 'CURRENCY_RATE_REQUIRED',
      field: 'currency',
    }
  }

  return {
    ok: true,
    basePriceThb: Math.round(amount * rate * 100) / 100,
    warnings: [
      {
        code: 'CURRENCY_CONVERTED',
        message: `Цена ${amount} ${currency} → ${Math.round(amount * rate * 100) / 100} THB (rate ${rate})`,
        field: 'basePriceThb',
      },
    ],
  }
}

/**
 * Parse lat/lng from geo object, "lat,lng" string, or Google Maps URL.
 * @param {unknown} geo
 * @param {unknown} mapsUrl
 */
export function normalizeGeo(geo, mapsUrl) {
  const warnings = []
  const base = geo && typeof geo === 'object' ? { ...geo } : {}
  let lat = base.lat != null ? Number(base.lat) : null
  let lng = base.lng != null ? Number(base.lng) : base.lon != null ? Number(base.lon) : null

  const tryParsePair = (raw) => {
    const m = String(raw || '').match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/)
    if (!m) return null
    return { lat: Number(m[1]), lng: Number(m[2]) }
  }

  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && base.coordinates) {
    const pair = tryParsePair(base.coordinates)
    if (pair) {
      lat = pair.lat
      lng = pair.lng
    }
  }

  const url = String(mapsUrl || base.mapsUrl || base.googleMapsUrl || '').trim()
  if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && url) {
    const at = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    const q = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    const hit = at || q
    if (hit) {
      lat = Number(hit[1])
      lng = Number(hit[2])
      warnings.push({
        code: 'GEO_FROM_MAPS_URL',
        message: 'Координаты извлечены из ссылки Maps',
        field: 'geo',
      })
    }
  }

  const addressText =
    base.addressText || base.address || base.district
      ? String(base.addressText || base.address || base.district).trim()
      : ''

  const out = {
    ...(Number.isFinite(lat) ? { lat } : {}),
    ...(Number.isFinite(lng) ? { lng } : {}),
    ...(addressText ? { addressText } : {}),
    ...(base.countryCode ? { countryCode: String(base.countryCode).toUpperCase() } : {}),
    ...(base.cityCode ? { cityCode: String(base.cityCode).toLowerCase() } : {}),
  }

  return { ok: true, geo: out, warnings }
}

/**
 * @param {unknown} amenities
 * @returns {{ amenitiesMeta: Record<string, boolean>, warnings: object[] }}
 */
export function normalizeAmenities(amenities) {
  const amenitiesMeta = {}
  const warnings = []
  if (!amenities) return { amenitiesMeta, warnings }

  if (Array.isArray(amenities)) {
    for (const raw of amenities) {
      const key = String(raw || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
      if (!key) continue
      const mapped = AMENITY_ALIASES[key] || AMENITY_ALIASES[key.replace(/_/g, ' ')] || key
      amenitiesMeta[mapped] = true
    }
    return { amenitiesMeta, warnings }
  }

  if (typeof amenities === 'object') {
    for (const [k, v] of Object.entries(amenities)) {
      if (v === true || v === 'true' || v === 1) {
        const key = String(k).trim().toLowerCase().replace(/\s+/g, '_')
        amenitiesMeta[AMENITY_ALIASES[key] || key] = true
      }
    }
  }

  return { amenitiesMeta, warnings }
}

/**
 * Core listing normalize shared by profiles.
 * @param {object} raw
 * @param {{ rateToThb?: Record<string, number> }} [opts]
 */
export function normalizeConciergeRawListing(raw, opts = {}) {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'listing item required', code: 'VALIDATION_ERROR' }
  }

  const externalId = String(raw.externalId || raw.id || raw.unitCode || '').trim()
  const title = String(raw.title || raw.name || '').trim()
  if (!externalId) {
    return { ok: false, error: 'externalId required', code: 'VALIDATION_ERROR', field: 'externalId' }
  }
  if (!title) {
    return {
      ok: false,
      error: `Отсутствует название объекта ${externalId}`,
      code: 'MISSING_TITLE',
      field: 'title',
    }
  }

  const price = resolveBasePriceThb(raw, opts)
  if (!price.ok) {
    return {
      ok: false,
      error: `Объект ${externalId}: ${price.error}`,
      code: price.code,
      field: price.field,
    }
  }

  const seasonsRes = normalizeSeasons(raw.seasons, externalId)
  if (!seasonsRes.ok) {
    return {
      ok: false,
      error: seasonsRes.error,
      code: seasonsRes.code,
      field: seasonsRes.field,
    }
  }

  const geoRes = normalizeGeo(raw.geo, raw.mapsUrl)
  const { images, mediaWarnings } = filterConciergeImagesWithDriveGuard(raw.images)
  const { amenitiesMeta } = normalizeAmenities(raw.amenities)

  const warnings = [
    ...price.warnings,
    ...seasonsRes.warnings,
    ...geoRes.warnings,
    ...mediaWarnings.map((w) => ({
      code: w.code,
      message: w.message,
      field: 'images',
      url: w.url,
    })),
  ]

  if (!Number.isFinite(geoRes.geo.lat) || !Number.isFinite(geoRes.geo.lng)) {
    warnings.push({
      code: 'GEO_COORDS_MISSING',
      message: `У объекта ${externalId} нет координат — партнёр сможет уточнить в кабинете`,
      field: 'geo',
    })
  }

  const listing = {
    externalId,
    title,
    description: String(raw.description || '').trim() || title,
    categorySlug: String(raw.categorySlug || 'stay').trim().toLowerCase() || 'stay',
    bedrooms: raw.bedrooms != null ? Number(raw.bedrooms) : null,
    bathrooms: raw.bathrooms != null ? Number(raw.bathrooms) : null,
    maxGuests: raw.maxGuests != null ? Number(raw.maxGuests) : null,
    sqm: raw.sqm != null ? Number(raw.sqm) : null,
    geo: geoRes.geo,
    basePriceThb: price.basePriceThb,
    seasons: seasonsRes.seasons,
    images,
    mediaWarnings,
    icalUrl: raw.icalUrl ? String(raw.icalUrl).trim() : '',
    amenities: amenitiesMeta,
  }

  return { ok: true, listing, warnings }
}

export function isHighSeasonRow(season) {
  const type = String(season?.seasonType || '').toLowerCase()
  if (type === 'high' || type === 'peak' || type === 'высокий') return true
  const label = String(season?.label || '').toLowerCase()
  return /high|peak|высокий|hi\b|dec|jan|christmas|ny|новогод/.test(label)
}
