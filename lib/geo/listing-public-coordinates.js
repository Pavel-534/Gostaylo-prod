/**
 * Stage 163.2 — SSOT public listing coordinates: policy, reveal, deterministic fuzz.
 *
 * ADR: docs/ADR/163-coordinate-privacy-ssot.md
 *
 * Rules:
 * - True coords stay in DB / PostGIS; obfuscation is on-read only.
 * - Vertical policy from category-behavior (wizard_profile + slug).
 * - Deterministic jitter: SHA-256(listingId + salt), not Math.random().
 */

import { createHash } from 'node:crypto'
import { resolveCategoryBehavior } from '@/lib/config/category-behavior'
import { recordCoordinatePrivacyMetrics } from '@/lib/geo/coordinate-privacy-metrics'
import { isStaffRole } from '@/lib/services/chat/access'

/** @typedef {'exact' | 'fuzz'} CoordinatePrivacyMode */
/** @typedef {'exact' | 'public_fuzz'} CoordinateRevealLevel */

/** Booking statuses that unlock exact coords for the renter. */
export const RENTER_COORD_REVEAL_STATUSES = new Set([
  'CONFIRMED',
  'PAID',
  'PAID_ESCROW',
  'THAWED',
  'COMPLETED',
])

const DEFAULT_RADIUS_MIN_M = 150
const DEFAULT_RADIUS_MAX_M = 300
const DEFAULT_SALT = 'coord-privacy-v1'

/**
 * @returns {number}
 */
export function getCoordPrivacyRadiusMinM() {
  const raw = process.env.COORD_PRIVACY_RADIUS_MIN_M
  const n = raw != null ? Number(raw) : DEFAULT_RADIUS_MIN_M
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_RADIUS_MIN_M
}

/**
 * @returns {number}
 */
export function getCoordPrivacyRadiusMaxM() {
  const raw = process.env.COORD_PRIVACY_RADIUS_MAX_M
  const n = raw != null ? Number(raw) : DEFAULT_RADIUS_MAX_M
  const min = getCoordPrivacyRadiusMinM()
  return Number.isFinite(n) && n >= min ? n : Math.max(min, DEFAULT_RADIUS_MAX_M)
}

/**
 * @returns {string}
 */
export function getCoordPrivacySalt() {
  const s = process.env.COORD_PRIVACY_SALT
  return s != null && String(s).trim() !== '' ? String(s).trim() : DEFAULT_SALT
}

/**
 * Category → coordinate privacy policy (delegates to category-behavior SSOT).
 *
 * @param {{ categorySlug?: string | null, categoryId?: string | null, wizardProfile?: string | null }} params
 * @returns {{ mode: CoordinatePrivacyMode, radiusMinM: number, radiusMaxM: number }}
 */
export function resolveCoordinatePrivacyPolicy({
  categorySlug = null,
  categoryId = null,
  wizardProfile = null,
} = {}) {
  void categoryId // legacy callers; slug + wizard_profile are canonical
  const behavior = resolveCategoryBehavior(categorySlug, wizardProfile)
  const mode = behavior.mapLocationDisplayMode === 'exact' ? 'exact' : 'fuzz'
  return {
    mode,
    radiusMinM: getCoordPrivacyRadiusMinM(),
    radiusMaxM: getCoordPrivacyRadiusMaxM(),
  }
}

/**
 * @param {string} listingId
 * @param {string} [salt]
 * @returns {Buffer}
 */
function privacyHashDigest(listingId, salt = getCoordPrivacySalt()) {
  return createHash('sha256').update(`${String(listingId)}:${salt}`, 'utf8').digest()
}

/**
 * @param {Buffer} digest
 * @param {number} byteOffset
 * @returns {number} ∈ [0, 1)
 */
function digestUnitFloat(digest, byteOffset) {
  const off = byteOffset % Math.max(1, digest.length - 3)
  return digest.readUInt32BE(off) / 0x1_0000_0000
}

/**
 * Geodesic destination point (WGS84 sphere).
 *
 * @param {number} latDeg
 * @param {number} lngDeg
 * @param {number} bearingDeg
 * @param {number} distanceM
 * @returns {{ lat: number, lng: number }}
 */
export function offsetCoordinatesMeters(latDeg, lngDeg, bearingDeg, distanceM) {
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

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lon2 * 180) / Math.PI,
  }
}

/**
 * Deterministic public offset for a listing (annulus jitter).
 *
 * @param {{ listingId: string, lat: number, lng: number, policy?: ReturnType<typeof resolveCoordinatePrivacyPolicy> }} params
 * @returns {{ lat: number, lng: number, isApproximate: boolean, radiusAppliedM: number | null }}
 */
export function obfuscateCoordinates({ listingId, lat, lng, policy }) {
  const pol =
    policy ??
    resolveCoordinatePrivacyPolicy({})
  if (pol.mode === 'exact') {
    return { lat, lng, isApproximate: false, radiusAppliedM: null }
  }

  const digest = privacyHashDigest(listingId)
  const bearingDeg = digestUnitFloat(digest, 0) * 360
  const span = Math.max(0, pol.radiusMaxM - pol.radiusMinM)
  const radiusAppliedM = pol.radiusMinM + digestUnitFloat(digest, 4) * span
  const shifted = offsetCoordinatesMeters(lat, lng, bearingDeg, radiusAppliedM)

  return {
    lat: shifted.lat,
    lng: shifted.lng,
    isApproximate: true,
    radiusAppliedM,
  }
}

/**
 * @param {object} params
 * @param {string | null | undefined} [params.viewerId]
 * @param {string | null | undefined} [params.viewerRole]
 * @param {{ id?: string, owner_id?: string, ownerId?: string }} params.listing
 * @param {Array<{ listing_id?: string, status?: string }>} [params.renterBookings]
 * @returns {CoordinateRevealLevel}
 */
export function resolveCoordinateRevealLevel({
  viewerId = null,
  viewerRole = null,
  listing,
  renterBookings = [],
} = {}) {
  const viewer = viewerId != null ? String(viewerId).trim() : ''
  const ownerId = String(listing?.owner_id ?? listing?.ownerId ?? '').trim()
  const role = String(viewerRole ?? '').toUpperCase()

  if (isStaffRole(role)) return 'exact'
  if (viewer && ownerId && viewer === ownerId) return 'exact'

  const listingId = String(listing?.id ?? '').trim()
  if (viewer && listingId && Array.isArray(renterBookings)) {
    const hasRevealBooking = renterBookings.some((b) => {
      if (String(b?.listing_id ?? '') !== listingId) return false
      return RENTER_COORD_REVEAL_STATUSES.has(String(b?.status ?? '').toUpperCase())
    })
    if (hasRevealBooking) return 'exact'
  }

  return 'public_fuzz'
}

/**
 * @param {number | string | null | undefined} value
 * @returns {number | null}
 */
function parseCoord(value) {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value))
  return Number.isFinite(n) ? n : null
}

/**
 * Single serialization entry for all public read-paths.
 *
 * @param {object} listingRow — DB row or API-shaped listing
 * @param {CoordinateRevealLevel} revealLevel
 * @param {ReturnType<typeof resolveCoordinatePrivacyPolicy>} [policy]
 * @returns {{
 *   latitude: number | null,
 *   longitude: number | null,
 *   isApproximate: boolean,
 *   locationPrivacyMode: CoordinatePrivacyMode,
 *   address: string | null,
 * }}
 */
export function serializePublicCoordinates(listingRow, revealLevel, policy) {
  const listingId = String(listingRow?.id ?? '').trim()
  const categorySlug =
    listingRow?.categorySlug ??
    listingRow?.categories?.slug ??
    listingRow?.category?.slug ??
    listingRow?.metadata?.category_slug ??
    null
  const wizardProfile =
    listingRow?.categories?.wizard_profile ??
    listingRow?.category?.wizard_profile ??
    null

  const pol =
    policy ??
    resolveCoordinatePrivacyPolicy({
      categorySlug,
      categoryId: listingRow?.category_id ?? listingRow?.categoryId,
      wizardProfile,
    })

  const trueLat = parseCoord(listingRow?.latitude ?? listingRow?.lat)
  const trueLng = parseCoord(listingRow?.longitude ?? listingRow?.lng)

  if (trueLat == null || trueLng == null) {
    return {
      latitude: null,
      longitude: null,
      isApproximate: pol.mode === 'fuzz',
      locationPrivacyMode: pol.mode,
      address: null,
    }
  }

  const rawAddress =
    listingRow?.address != null && String(listingRow.address).trim() !== ''
      ? String(listingRow.address).trim()
      : null

  if (revealLevel === 'exact' || pol.mode === 'exact') {
    recordCoordinatePrivacyMetrics({
      revealLevel: 'exact',
      policyMode: 'exact',
      fuzzApplied: false,
    })
    return {
      latitude: trueLat,
      longitude: trueLng,
      isApproximate: false,
      locationPrivacyMode: 'exact',
      address: rawAddress,
    }
  }

  const fuzz = obfuscateCoordinates({
    listingId,
    lat: trueLat,
    lng: trueLng,
    policy: pol,
  })

  recordCoordinatePrivacyMetrics({
    revealLevel,
    policyMode: pol.mode,
    fuzzApplied: true,
  })

  return {
    latitude: fuzz.lat,
    longitude: fuzz.lng,
    isApproximate: true,
    locationPrivacyMode: 'fuzz',
    address: null,
  }
}

/**
 * Haversine distance in meters (for tests / QA).
 *
 * @param {number} lat1
 * @param {number} lng1
 * @param {number} lat2
 * @param {number} lng2
 * @returns {number}
 */
export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6_371_000
  const p1 = (lat1 * Math.PI) / 180
  const p2 = (lat2 * Math.PI) / 180
  const dp = ((lat2 - lat1) * Math.PI) / 180
  const dl = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2)
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
