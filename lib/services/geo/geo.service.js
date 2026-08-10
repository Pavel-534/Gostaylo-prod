/**
 * Stage 200.35 — GeoService SSOT for Nominatim + geo_locations reads/writes.
 * All Nominatim HTTP must go through this module (ADR-200.35).
 */

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { getNominatimUserAgent } from '@/lib/http-client-identity'
import {
  COUNTRY_CURRENCY_TZ,
  LAUNCH_GEO_SEED,
} from '@/lib/geo/launch-markets-seed-data'
import { getDefaultListingBaseCurrency } from '@/lib/listing/listing-asset-currency'
import { defaultTimezoneForCountryCode } from '@/lib/geo/listing-timezone-ssot'
import { resolveListingPlaceTimezone } from '@/lib/geo/listing-timezone-guess'
import { getIsoCountryLabel } from '@/lib/geo/iso-countries-catalog'
import {
  normalizeGeoPlaceKey,
  normalizeGeoPlaceName,
} from '@/lib/geo/normalize-geo-place-name'

const NOMINATIM_SEARCH = 'https://nominatim.openstreetmap.org/search'
const NOMINATIM_REVERSE = 'https://nominatim.openstreetmap.org/reverse'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function hashKey(kind, payload) {
  return createHash('sha256').update(`${kind}:${payload}`).digest('hex')
}

function slugifyCode(name) {
  return String(name || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64)
}

async function readCache(queryHash) {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('nominatim_cache')
    .select('response_json, expires_at')
    .eq('query_hash', queryHash)
    .maybeSingle()
  if (error || !data) return null
  if (new Date(data.expires_at).getTime() < Date.now()) return null
  return data.response_json
}

async function writeCache(queryHash, kind, responseJson) {
  if (!supabaseAdmin) return
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString()
  await supabaseAdmin.from('nominatim_cache').upsert(
    {
      query_hash: queryHash,
      kind,
      response_json: responseJson,
      expires_at: expiresAt,
    },
    { onConflict: 'query_hash' },
  )
}

function mapSearchResults(raw) {
  return (Array.isArray(raw) ? raw : []).map((r) => ({
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    displayName: r.display_name,
    type: r.type,
    level: null,
    labelEn: null,
    labelRu: null,
    code: null,
    source: 'nominatim',
    address: r.address || {},
    osmId: r.osm_id != null ? String(r.osm_id) : null,
    osmType: r.osm_type || null,
    placeId: r.place_id != null ? String(r.place_id) : null,
  }))
}

/**
 * Catalog autocomplete from geo_locations (+ optional synonym hit).
 * Never invents a default city — returns only DB matches.
 */
async function suggestFromCatalog(query, countryCode) {
  if (!supabaseAdmin) return []
  const q = String(query || '').trim()
  if (q.length < 2) return []
  const cc = countryCode ? String(countryCode).toUpperCase().slice(0, 2) : ''
  const needle = q
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')

  let qb = supabaseAdmin
    .from('geo_locations')
    .select(
      'code,level,parent_code,label_en,label_ru,label_th,label_zh,country_code,centroid_lat,centroid_lng,iso_country',
    )
    .eq('is_active', true)
    .in('level', ['country', 'region', 'city', 'neighborhood'])
    .limit(400)

  if (cc) qb = qb.eq('country_code', cc)

  const { data: rows } = await qb
  const matched = (rows || []).filter((row) => {
    const hay = [row.label_en, row.label_ru, row.label_th, row.label_zh, row.code]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
    return hay.includes(needle)
  })

  const out = []
  for (const row of matched.slice(0, 8)) {
    const lat = row.centroid_lat != null ? Number(row.centroid_lat) : null
    const lng = row.centroid_lng != null ? Number(row.centroid_lng) : null
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const labelEn = row.label_en || row.code
    const labelRu = row.label_ru || labelEn
    out.push({
      lat,
      lon: lng,
      displayName: labelRu !== labelEn ? `${labelRu} / ${labelEn}` : labelEn,
      type: row.level,
      level: row.level,
      labelEn,
      labelRu,
      code: row.code,
      source: 'geo_locations',
      address: {
        country_code: (row.country_code || row.iso_country || '').toLowerCase() || undefined,
        country: row.country_code || row.iso_country || undefined,
        state: row.level === 'region' ? labelEn : undefined,
        city: row.level === 'city' || row.level === 'neighborhood' ? labelEn : undefined,
      },
      regionCode: row.level === 'region' ? row.code : row.level === 'city' ? row.parent_code : null,
      cityCode: row.level === 'city' || row.level === 'neighborhood' ? row.code : null,
    })
  }

  try {
    const { data: synRows } = await supabaseAdmin
      .from('geo_synonyms')
      .select('target_code, alias_term')
      .limit(300)
    const synHit = (synRows || []).find((r) => {
      const a = String(r.alias_term || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
      return a === needle || a.includes(needle)
    })
    const synCode = synHit?.target_code
    if (synCode && !out.some((r) => r.code === synCode)) {
      const { data: node } = await supabaseAdmin
        .from('geo_locations')
        .select('*')
        .eq('code', synCode)
        .eq('is_active', true)
        .maybeSingle()
      if (node?.centroid_lat != null && node?.centroid_lng != null) {
        if (!cc || String(node.country_code || '').toUpperCase() === cc) {
          const labelEn = node.label_en || node.code
          const labelRu = node.label_ru || labelEn
          out.unshift({
            lat: Number(node.centroid_lat),
            lon: Number(node.centroid_lng),
            displayName: labelRu !== labelEn ? `${labelRu} / ${labelEn}` : labelEn,
            type: node.level,
            level: node.level,
            labelEn,
            labelRu,
            code: node.code,
            source: 'geo_synonyms',
            address: {
              country_code: (node.country_code || '').toLowerCase() || undefined,
            },
            regionCode: node.level === 'region' ? node.code : node.parent_code,
            cityCode: node.level === 'city' || node.level === 'neighborhood' ? node.code : null,
          })
        }
      }
    }
  } catch {
    /* ignore synonym failures */
  }

  return out.slice(0, 8)
}

function mapReverseResult(data) {
  const addr = data?.address || {}
  // Micro-area only — never promote city/state into district (Stage 200.83).
  const district =
    addr.suburb ||
    addr.neighbourhood ||
    addr.city_district ||
    addr.quarter ||
    ''
  const city = addr.city || addr.municipality || addr.town || addr.village || ''
  const countryCode = String(addr.country_code || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  return {
    displayName: data.display_name || '',
    district,
    city,
    country: addr.country || '',
    countryCode: countryCode || null,
    state: addr.state || addr.region || null,
    address: addr,
    osmId: data.osm_id != null ? String(data.osm_id) : null,
    osmType: data.osm_type || null,
    placeId: data.place_id != null ? String(data.place_id) : null,
    lat: data.lat != null ? parseFloat(data.lat) : null,
    lon: data.lon != null ? parseFloat(data.lon) : null,
  }
}

/**
 * Match reverse/search place to curated geo_locations (best-effort).
 */
async function matchCatalogCodes({ countryCode, state, city }) {
  const iso = String(countryCode || '').toUpperCase()
  let region_code = null
  let city_code = null
  let city_name = city || null

  if (!supabaseAdmin || !iso) {
    return { country_code: iso || null, region_code, city_code, city_name }
  }

  const { data: cities } = await supabaseAdmin
    .from('geo_locations')
    .select('code, label_en, label_ru, parent_code, level')
    .eq('country_code', iso)
    .eq('is_active', true)
    .in('level', ['city', 'neighborhood'])

  const needle = String(city || state || '')
    .toLowerCase()
    .trim()
  if (needle && cities?.length) {
    const hit = cities.find((c) => {
      const en = String(c.label_en || '').toLowerCase()
      const ru = String(c.label_ru || '').toLowerCase()
      return en === needle || ru === needle || en.includes(needle) || needle.includes(en)
    })
    if (hit) {
      if (hit.level === 'city') {
        city_code = hit.code
        region_code = hit.parent_code
      } else {
        city_code = hit.parent_code
        const parent = cities.find((c) => c.code === hit.parent_code)
        region_code = parent?.parent_code || null
      }
      city_name = hit.label_en || city_name
    }
  }

  // Stage 200.83 — match region by Nominatim state when city miss / no region yet
  if (!region_code && state) {
    const stateNeedle = String(state || '')
      .toLowerCase()
      .trim()
    const { data: regions } = await supabaseAdmin
      .from('geo_locations')
      .select('code, label_en, label_ru')
      .eq('country_code', iso)
      .eq('level', 'region')
      .eq('is_active', true)
    const rh = (regions || []).find((r) => {
      const en = String(r.label_en || '').toLowerCase()
      const ru = String(r.label_ru || '').toLowerCase()
      return (
        en === stateNeedle ||
        ru === stateNeedle ||
        (en.length >= 4 && stateNeedle.includes(en)) ||
        (ru.length >= 4 && stateNeedle.includes(ru)) ||
        (en.length >= 4 && en.includes(stateNeedle)) ||
        (ru.length >= 4 && ru.includes(stateNeedle))
      )
    })
    if (rh) region_code = rh.code
  }

  return {
    country_code: iso,
    region_code,
    city_code,
    city_name,
  }
}

export const GeoService = {
  /**
   * Reverse geocode with cache → catalog codes + currency/TZ.
   * @param {number} lat
   * @param {number} lng
   */
  async resolveFromPin(lat, lng) {
    const latN = Number(lat)
    const lngN = Number(lng)
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) {
      throw Object.assign(new Error('Valid lat/lng required'), { code: 'GEO_INVALID_COORDS' })
    }

    const qHash = hashKey('reverse', `${latN.toFixed(5)},${lngN.toFixed(5)}`)
    let raw = await readCache(qHash)
    let fromCache = !!raw

    if (!raw) {
      const params = new URLSearchParams({
        lat: String(latN),
        lon: String(lngN),
        format: 'json',
        addressdetails: '1',
        'accept-language': 'en',
      })
      try {
        const res = await fetch(`${NOMINATIM_REVERSE}?${params}`, {
          headers: {
            'User-Agent': getNominatimUserAgent(),
            'Accept-Language': 'en',
          },
        })
        if (!res.ok) {
          throw Object.assign(new Error('Reverse geocoding unavailable'), {
            code: 'NOMINATIM_UNAVAILABLE',
            status: res.status,
          })
        }
        raw = await res.json()
        await writeCache(qHash, 'reverse', raw)
      } catch (err) {
        if (err?.code === 'NOMINATIM_UNAVAILABLE') throw err
        // Graceful degrade: country unknown, still return coords for manual cascade
        return {
          ok: false,
          degraded: true,
          country_code: null,
          region_code: null,
          city_code: null,
          city_name: null,
          district: null,
          timezone: null,
          currency_code: null,
          osm_id: null,
          displayName: '',
          address: {},
          error: err?.message || 'Nominatim failed',
        }
      }
    }

    const mapped = mapReverseResult(raw)
    const matched = await matchCatalogCodes({
      countryCode: mapped.countryCode,
      state: mapped.state,
      city: mapped.city,
    })
    const ct = await this.getCurrencyAndTimezone(matched.country_code)

    return {
      ok: true,
      fromCache,
      country_code: matched.country_code,
      region_code: matched.region_code,
      city_code: matched.city_code,
      city_name: matched.city_name || mapped.city,
      district: mapped.district || null,
      timezone: ct.timezone,
      currency_code: ct.currency,
      osm_id: mapped.osmId,
      osm_type: mapped.osmType,
      nominatim_place_id: mapped.placeId,
      displayName: mapped.displayName,
      address: mapped.address,
      geo_source: fromCache ? 'nominatim_cache' : 'nominatim',
    }
  },

  /**
   * Forward search: catalog (geo_locations/synonyms) first, then Nominatim cache.
   * @param {string} query
   * @param {string} [countryCode]
   */
  async resolveFromQuery(query, countryCode) {
    const q = String(query || '').trim()
    if (q.length < 3) {
      throw Object.assign(new Error('Query too short (min 3 chars)'), { code: 'GEO_QUERY_SHORT' })
    }
    const cc = countryCode ? String(countryCode).toUpperCase().slice(0, 2) : ''

    const catalog = await suggestFromCatalog(q, cc || undefined)

    const qHash = hashKey('search', `${cc}|${q.toLowerCase()}`)
    let raw = await readCache(qHash)
    let nominatim = []

    try {
      if (!raw) {
        const params = new URLSearchParams({
          q,
          format: 'json',
          limit: '5',
          addressdetails: '1',
        })
        if (cc) params.set('countrycodes', cc.toLowerCase())
        const res = await fetch(`${NOMINATIM_SEARCH}?${params}`, {
          headers: { 'User-Agent': getNominatimUserAgent() },
        })
        if (!res.ok) {
          if (catalog.length) return catalog
          throw Object.assign(new Error('Geocoding service unavailable'), {
            code: 'NOMINATIM_UNAVAILABLE',
            status: res.status,
          })
        }
        raw = await res.json()
        await writeCache(qHash, 'search', raw)
      }
      nominatim = mapSearchResults(raw)
    } catch (err) {
      if (catalog.length) return catalog
      throw err
    }

    // Dedupe by rough lat/lon; prefer catalog rows
    const seen = new Set(catalog.map((r) => `${Number(r.lat).toFixed(3)},${Number(r.lon).toFixed(3)}`))
    const merged = [...catalog]
    for (const n of nominatim) {
      const key = `${Number(n.lat).toFixed(3)},${Number(n.lon).toFixed(3)}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(n)
    }
    return merged.slice(0, 10)
  },

  /**
   * Ensure ISO country row exists in geo_locations (FK-safe for assertListingGeoCodes).
   * Stage 200.45 — wizard country typeahead for non-seed markets.
   */
  async ensureCountryLocation({
    code,
    labelEn = null,
    labelRu = null,
    labelTh = null,
    labelZh = null,
  } = {}) {
    if (!supabaseAdmin) {
      throw Object.assign(new Error('Supabase admin unavailable'), { code: 'GEO_DB_UNAVAILABLE' })
    }
    const iso = String(code || '')
      .trim()
      .toUpperCase()
      .slice(0, 2)
    if (!/^[A-Z]{2}$/.test(iso)) {
      throw Object.assign(new Error('country_code required'), { code: 'GEO_COUNTRY_REQUIRED' })
    }

    const { data: existing } = await supabaseAdmin
      .from('geo_locations')
      .select('*')
      .eq('code', iso)
      .eq('level', 'country')
      .maybeSingle()
    if (existing) {
      if (existing.is_active === false) {
        await supabaseAdmin
          .from('geo_locations')
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq('code', iso)
      }
      return existing
    }

    const seed = LAUNCH_GEO_SEED.find((n) => n.code === iso && n.level === 'country')
    const ct = COUNTRY_CURRENCY_TZ[iso] || {
      currency: getDefaultListingBaseCurrency(iso),
      timezone:
        defaultTimezoneForCountryCode(iso) ||
        'Asia/Bangkok',
    }
    const row = {
      code: iso,
      level: 'country',
      parent_code: null,
      label_en: String(labelEn || seed?.label_en || getIsoCountryLabel(iso, 'en') || iso).slice(
        0,
        120,
      ),
      label_ru: String(labelRu || seed?.label_ru || getIsoCountryLabel(iso, 'ru') || iso).slice(
        0,
        120,
      ),
      label_th: String(labelTh || seed?.label_th || getIsoCountryLabel(iso, 'th') || iso).slice(
        0,
        120,
      ),
      label_zh: String(labelZh || seed?.label_zh || getIsoCountryLabel(iso, 'zh') || iso).slice(
        0,
        120,
      ),
      iso_country: iso,
      country_code: iso,
      centroid_lat: seed?.centroid_lat ?? null,
      centroid_lng: seed?.centroid_lng ?? null,
      timezone: seed?.timezone || ct.timezone,
      currency_code: seed?.currency_code || ct.currency,
      is_active: true,
      is_auto_imported: !seed,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin.from('geo_locations').insert(row).select('*').single()
    if (error) {
      // Race: another request inserted the same ISO
      const { data: again } = await supabaseAdmin
        .from('geo_locations')
        .select('*')
        .eq('code', iso)
        .eq('level', 'country')
        .maybeSingle()
      if (again) return again
      throw Object.assign(new Error(error.message || 'ensure country failed'), {
        code: 'GEO_UPSERT_FAILED',
        cause: error,
      })
    }
    return data
  },

  /**
   * Create provisional geo_locations row (pin outside curated hubs).
   */
  async upsertProvisionalLocation({
    name,
    level = 'city',
    parent_code = null,
    lat,
    lng,
    country_code,
    timezone = null,
  }) {
    if (!supabaseAdmin) {
      throw Object.assign(new Error('Supabase admin unavailable'), { code: 'GEO_DB_UNAVAILABLE' })
    }
    const iso = String(country_code || '').toUpperCase().slice(0, 2)
    if (!iso) {
      throw Object.assign(new Error('country_code required'), { code: 'GEO_COUNTRY_REQUIRED' })
    }
    await this.ensureCountryLocation({ code: iso })

    const displayName = normalizeGeoPlaceName(name)
    if (!displayName || displayName.length < 2) {
      throw Object.assign(new Error('name required'), { code: 'GEO_NAME_REQUIRED' })
    }

    const base = slugifyCode(displayName) || `place-${Date.now()}`
    let code = base
    const { data: existing } = await supabaseAdmin
      .from('geo_locations')
      .select('code')
      .eq('code', code)
      .maybeSingle()
    if (existing) {
      code = `${base}-${iso.toLowerCase()}-${Math.floor(Math.random() * 900 + 100)}`
    }

    const ct = await this.getCurrencyAndTimezone(iso)
    const latN = Number(lat)
    const lngN = Number(lng)
    const hasCentroid = Number.isFinite(latN) && Number.isFinite(lngN)
    // Stage 200.47 — pin/place TZ when coords present; never leave empty labels
    const placeTz = resolveListingPlaceTimezone({
      lat: hasCentroid ? latN : null,
      lon: hasCentroid ? lngN : null,
      explicitTimezone: timezone,
      countryCode: iso,
    })
    const row = {
      code,
      level,
      parent_code,
      label_en: displayName.slice(0, 120),
      label_ru: displayName.slice(0, 120),
      iso_country: iso,
      country_code: iso,
      centroid_lat: hasCentroid ? latN : null,
      centroid_lng: hasCentroid ? lngN : null,
      timezone: placeTz || ct.timezone || 'Asia/Bangkok',
      currency_code: level === 'country' ? ct.currency : null,
      is_active: true,
      is_auto_imported: true,
      updated_at: new Date().toISOString(),
    }

    const { data, error } = await supabaseAdmin.from('geo_locations').insert(row).select('*').single()
    if (error) {
      throw Object.assign(new Error(error.message || 'upsert failed'), {
        code: 'GEO_UPSERT_FAILED',
        cause: error,
      })
    }
    return data
  },

  async getByCode(code) {
    if (!supabaseAdmin || !code) return null
    const { data } = await supabaseAdmin
      .from('geo_locations')
      .select('*')
      .eq('code', code)
      .eq('is_active', true)
      .maybeSingle()
    return data || null
  },

  async getHierarchy(code) {
    const chain = []
    let current = await this.getByCode(code)
    const guard = new Set()
    while (current && !guard.has(current.code)) {
      chain.push(current)
      guard.add(current.code)
      if (!current.parent_code) break
      current = await this.getByCode(current.parent_code)
    }
    return chain
  },

  async getChildren(code, level) {
    if (!supabaseAdmin || !code) return []
    let q = supabaseAdmin
      .from('geo_locations')
      .select('*')
      .eq('parent_code', code)
      .eq('is_active', true)
      .order('label_en')
    if (level) q = q.eq('level', level)
    const { data } = await q
    return data || []
  },

  async getCurrencyAndTimezone(countryCode) {
    const iso = String(countryCode || '').toUpperCase().slice(0, 2)
    const seed = COUNTRY_CURRENCY_TZ[iso]
    const fallback = {
      currency: seed?.currency || getDefaultListingBaseCurrency(iso) || 'USD',
      timezone:
        seed?.timezone || defaultTimezoneForCountryCode(iso) || 'Asia/Bangkok',
    }
    if (!supabaseAdmin || !iso) return fallback

    const { data } = await supabaseAdmin
      .from('geo_locations')
      .select('currency_code, timezone')
      .eq('code', iso)
      .eq('level', 'country')
      .maybeSingle()

    return {
      currency: data?.currency_code || fallback.currency,
      timezone: data?.timezone || fallback.timezone,
    }
  },

  async getCentroid(code) {
    const row = await this.getByCode(code)
    if (!row?.centroid_lat || row?.centroid_lng == null) {
      const seed = LAUNCH_GEO_SEED.find((n) => n.code === code)
      if (seed) return { lat: seed.centroid_lat, lng: seed.centroid_lng }
      return null
    }
    return { lat: Number(row.centroid_lat), lng: Number(row.centroid_lng) }
  },

  async findBySynonym(alias, locale = '*') {
    if (!supabaseAdmin || !alias) return null
    const term = String(alias).trim().toLowerCase()
    const langs = locale && locale !== '*' ? [locale, '*'] : ['*']
    const { data } = await supabaseAdmin
      .from('geo_synonyms')
      .select('target_code, target_type, lang, weight, alias_term')
      .in('lang', langs)
      .limit(200)
    if (!data?.length) return null
    const exact = data.find((r) => String(r.alias_term || '').toLowerCase() === term)
    if (exact) return exact.target_code
    const partial = data.find((r) => String(r.alias_term || '').toLowerCase().includes(term))
    return partial?.target_code || null
  },

  /** Test helper — expose hash without DB. */
  _hashKey: hashKey,
  _slugifyCode: slugifyCode,
}

export default GeoService
