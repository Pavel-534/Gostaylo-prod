/**
 * ADR-163 matrix smoke (T1–T12 subset) — no Jest required.
 * Run: npm run verify:coord-privacy
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

// Pure math (mirrors lib/geo/listing-public-coordinates.js — avoids @/ import chain in Node)
function offsetCoordinatesMeters(latDeg, lngDeg, bearingDeg, distanceM) {
  const R = 6_371_000
  const brng = (bearingDeg * Math.PI) / 180
  const lat1 = (latDeg * Math.PI) / 180
  const lon1 = (lngDeg * Math.PI) / 180
  const d = distanceM / R
  const sinLat1 = Math.sin(lat1)
  const cosLat1 = Math.cos(lat1)
  const sinD = Math.sin(d)
  const cosD = Math.cos(d)
  const lat2 = Math.asin(sinLat1 * cosD + cosLat1 * sinD * Math.cos(brng))
  const lon2 =
    lon1 +
    Math.atan2(Math.sin(brng) * sinD * cosLat1, cosD - sinLat1 * Math.sin(lat2))
  return { lat: (lat2 * 180) / Math.PI, lng: (lon2 * 180) / Math.PI }
}

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function obfuscateCoordinates({ listingId, lat, lng, policy }) {
  if (policy.mode === 'exact') {
    return { lat, lng, isApproximate: false, radiusAppliedM: null }
  }
  const digest = createHash('sha256').update(`${listingId}:verify-salt`, 'utf8').digest()
  const bearingDeg = (digest.readUInt32BE(0) / 0x1_0000_0000) * 360
  const span = Math.max(0, policy.radiusMaxM - policy.radiusMinM)
  const radiusAppliedM = policy.radiusMinM + (digest.readUInt32BE(4) / 0x1_0000_0000) * span
  const shifted = offsetCoordinatesMeters(lat, lng, bearingDeg, radiusAppliedM)
  return { lat: shifted.lat, lng: shifted.lng, isApproximate: true, radiusAppliedM }
}

const TRUE_LAT = 7.88
const TRUE_LNG = 98.3923
const LISTING_ID = 'lst-privacy-verify'
const FUZZ_POLICY = { mode: 'fuzz', radiusMinM: 150, radiusMaxM: 300 }
const EXACT_POLICY = { mode: 'exact', radiusMinM: 150, radiusMaxM: 300 }

const fuzz = obfuscateCoordinates({
  listingId: LISTING_ID,
  lat: TRUE_LAT,
  lng: TRUE_LNG,
  policy: FUZZ_POLICY,
})
const dist = haversineDistanceMeters(TRUE_LAT, TRUE_LNG, fuzz.lat, fuzz.lng)
assert.ok(fuzz.isApproximate && dist >= 149 && dist <= 301, `T1 annulus (${dist.toFixed(1)} m)`)

const exact = obfuscateCoordinates({
  listingId: LISTING_ID,
  lat: TRUE_LAT,
  lng: TRUE_LNG,
  policy: EXACT_POLICY,
})
assert.equal(exact.lat, TRUE_LAT, 'T3 transport exact')
assert.equal(exact.isApproximate, false, 'T3 no approximate flag')

const a = obfuscateCoordinates({ listingId: LISTING_ID, lat: TRUE_LAT, lng: TRUE_LNG, policy: FUZZ_POLICY })
const b = obfuscateCoordinates({ listingId: LISTING_ID, lat: TRUE_LAT, lng: TRUE_LNG, policy: FUZZ_POLICY })
assert.deepEqual(a, b, 'T12 determinism')

const other = obfuscateCoordinates({ listingId: 'other-id', lat: TRUE_LAT, lng: TRUE_LNG, policy: FUZZ_POLICY })
assert.ok(a.lat !== other.lat || a.lng !== other.lng, 'T11 different ids')

console.log('verify-coord-privacy-ssot: OK', {
  offsetM: dist.toFixed(1),
  publicLat: fuzz.lat.toFixed(5),
  publicLng: fuzz.lng.toFixed(5),
})
