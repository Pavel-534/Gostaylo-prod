/**
 * Stage 112.3 / 200.84 — geocode reverse (MapPicker + wizard).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

/**
 * @param {number} lat
 * @param {number} lon
 * @param {{ lang?: string }} [opts]
 */
export async function fetchReverseGeocode(lat, lon, opts = {}) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  })
  if (opts.lang) params.set('lang', String(opts.lang))
  const res = await fetch(`/api/v2/geocode/reverse?${params}`, { cache: 'no-store' })
  const json = await readJson(res)
  return { ok: res.ok && json.success === true, data: json.data ?? null, json, status: res.status }
}
