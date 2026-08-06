/**
 * Stage 200.36 / 200.45 — ensure country + provisional city_code before listing save.
 */

import {
  normalizeGeoPlaceName,
} from '@/lib/geo/normalize-geo-place-name'

async function ensureCountryCode(country) {
  const res = await fetch('/api/v2/partner/geo/ensure-country', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ country_code: country }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success) {
    return { ok: false, error: json.error || 'ensure_country_failed' }
  }
  return { ok: true, data: json.data }
}

/**
 * @param {Record<string, unknown>} formData
 */
export async function ensureProvisionalCityCode(formData) {
  const country = String(formData?.country || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const region = String(formData?.region || '').trim()
  let city = String(formData?.city || '').trim()
  const cityLabel = normalizeGeoPlaceName(
    formData?.metadata?.city_label || formData?.metadata?.city || '',
  )

  if (!/^[A-Z]{2}$/.test(country)) {
    return { ok: false, error: 'country_required', formData }
  }

  const countryEnsure = await ensureCountryCode(country)
  if (!countryEnsure.ok) {
    return { ok: false, error: countryEnsure.error || 'ensure_country_failed', formData }
  }

  if (city) {
    return {
      ok: true,
      formData: {
        ...formData,
        metadata: {
          ...(formData.metadata || {}),
          ...(cityLabel
            ? { city_label: cityLabel, city: cityLabel }
            : {}),
        },
      },
      cityCode: city,
    }
  }

  if (!cityLabel || cityLabel.length < 2) {
    return { ok: false, error: 'city_required', formData }
  }

  const res = await fetch('/api/v2/partner/geo/provisional', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      name: cityLabel,
      country_code: country,
      parent_code: region || null,
      level: 'city',
      lat: formData.latitude,
      lng: formData.longitude,
      timezone: formData.metadata?.timezone || null,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.success || !json.data?.code) {
    return { ok: false, error: json.error || 'provisional_failed', formData }
  }

  const next = {
    ...formData,
    city: json.data.code,
    region: formData.region || json.data.parent_code || region,
    metadata: {
      ...(formData.metadata || {}),
      city_label: cityLabel,
      city: cityLabel,
      geo_city_unmatched: false,
      geo_source: 'provisional',
    },
  }
  return { ok: true, formData: next, cityCode: json.data.code, created: !json.reused }
}
