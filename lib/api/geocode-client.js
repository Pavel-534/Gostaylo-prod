/**
 * Stage 112.3 — geocode reverse (MapPicker).
 */

async function readJson(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function fetchReverseGeocode(lat, lon) {
  const res = await fetch(`/api/v2/geocode/reverse?lat=${lat}&lon=${lon}`, { cache: 'no-store' })
  const json = await readJson(res)
  return { ok: res.ok && json.success === true, data: json.data ?? null, json, status: res.status }
}
