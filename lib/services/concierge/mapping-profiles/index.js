/**
 * ADR-210 Slice 6 — Mapping profiles registry.
 */

import { MAPPING_PROFILE_IDS } from './types.js'
import { genericConciergeV1 } from './generic_concierge_v1.js'
import { showPropertyV1 } from './show_property_v1.js'

/** @type {Map<string, import('./types.js').MappingProfile>} */
const REGISTRY = new Map([
  [genericConciergeV1.id, genericConciergeV1],
  [showPropertyV1.id, showPropertyV1],
])

export { MAPPING_PROFILE_IDS }

export function listMappingProfiles() {
  return [...REGISTRY.values()].map((p) => ({
    id: p.id,
    label: p.label,
    description: p.description,
  }))
}

/**
 * @param {string|null|undefined} id
 * @returns {import('./types.js').MappingProfile|null}
 */
export function getMappingProfile(id) {
  const key = String(id || '')
    .trim()
    .toLowerCase()
  if (!key) return genericConciergeV1
  return REGISTRY.get(key) || null
}

/**
 * @param {string|null|undefined} id
 */
export function resolveMappingProfileOrError(id) {
  const key = String(id || '')
    .trim()
    .toLowerCase()
  if (!key) {
    return { ok: true, profile: genericConciergeV1 }
  }
  const profile = REGISTRY.get(key)
  if (!profile) {
    return {
      ok: false,
      error: `Unknown mappingProfile "${id}". Known: ${[...REGISTRY.keys()].join(', ')}`,
      code: 'UNKNOWN_MAPPING_PROFILE',
    }
  }
  return { ok: true, profile }
}

/**
 * Normalize a package through the selected profile.
 * @param {string|null|undefined} mappingProfileId
 * @param {object[]} listings
 * @param {{ rateToThb?: Record<string, number> }} [opts]
 */
export function applyMappingProfile(mappingProfileId, listings, opts = {}) {
  const resolved = resolveMappingProfileOrError(mappingProfileId)
  if (!resolved.ok) {
    return {
      ok: false,
      errors: [{ code: resolved.code, message: resolved.error }],
      warnings: [],
      listings: [],
      profileId: null,
    }
  }

  const profile = resolved.profile

  // Single normalize pass (validatePackage would double-run + duplicate warnings).
  if (!Array.isArray(listings) || listings.length === 0) {
    return {
      ok: false,
      errors: [{ code: 'EMPTY_PACKAGE', message: 'listings array required' }],
      warnings: [],
      listings: [],
      profileId: profile.id,
    }
  }

  const errors = []
  const warnings = []
  const normalized = []
  const seen = new Set()

  for (const raw of listings) {
    const result = profile.normalizeListing(raw, opts)
    const externalId = String(raw?.externalId || raw?.id || '?')
    if (!result.ok) {
      errors.push({
        externalId,
        code: result.code || 'VALIDATION_ERROR',
        message: result.error,
        field: result.field,
      })
      continue
    }
    if (seen.has(result.listing.externalId)) {
      errors.push({
        externalId: result.listing.externalId,
        code: 'DUPLICATE_EXTERNAL_ID',
        message: `Дублируется externalId ${result.listing.externalId}`,
      })
    }
    seen.add(result.listing.externalId)
    normalized.push(result.listing)
    for (const w of result.warnings || []) {
      warnings.push({ externalId: result.listing.externalId, ...w })
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errors,
      warnings,
      listings: [],
      profileId: profile.id,
    }
  }

  return {
    ok: true,
    errors: [],
    warnings,
    listings: normalized,
    profileId: profile.id,
  }
}
