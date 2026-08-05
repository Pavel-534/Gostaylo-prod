/**
 * Stage 200.36 — ensure provisional city_code exists in geo_locations before listing save.
 */
export async function ensureProvisionalCityCode(formData) {
  const country = String(formData?.country || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const region = String(formData?.region || '').trim()
  let city = String(formData?.city || '').trim()
  const cityLabel = String(
    formData?.metadata?.city_label || formData?.metadata?.city || '',
  ).trim()

  if (!/^[A-Z]{2}$/.test(country)) {
    return { ok: false, error: 'country_required', formData }
  }

  if (city) {
    return { ok: true, formData, cityCode: city }
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
