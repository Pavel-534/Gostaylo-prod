/**
 * ADR-210 Slice 6 — universal Concierge mapping profile.
 */

import { MAPPING_PROFILE_IDS } from './types.js'
import { normalizeConciergeRawListing } from './normalize-shared.js'

export const genericConciergeV1 = {
  id: MAPPING_PROFILE_IDS.GENERIC,
  label: 'Generic Concierge v1',
  description:
    'Универсальный профиль: THB (или currency+rate), сезоны YYYY-MM-DD, geo, amenities, HTTPS images.',

  /**
   * @param {object} raw
   * @param {{ rateToThb?: Record<string, number> }} [opts]
   */
  normalizeListing(raw, opts = {}) {
    return normalizeConciergeRawListing(raw, opts)
  },

  /**
   * @param {object[]} listings
   * @param {{ rateToThb?: Record<string, number> }} [opts]
   */
  validatePackage(listings, opts = {}) {
    const errors = []
    const warnings = []
    if (!Array.isArray(listings) || listings.length === 0) {
      return {
        ok: false,
        errors: [{ code: 'EMPTY_PACKAGE', message: 'listings array required' }],
        warnings,
      }
    }

    const seen = new Set()
    for (const raw of listings) {
      const result = this.normalizeListing(raw, opts)
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
      for (const w of result.warnings || []) {
        warnings.push({ externalId: result.listing.externalId, ...w })
      }
    }

    return { ok: errors.length === 0, errors, warnings }
  },
}

export default genericConciergeV1
