/**
 * ADR-210 Slice 6 — Show Property (Phuket-style) rate-card mapping profile.
 * Requires seasonal grid with an identifiable high/peak season price.
 */

import { MAPPING_PROFILE_IDS } from './types.js'
import {
  isHighSeasonRow,
  normalizeConciergeRawListing,
} from './normalize-shared.js'

export const showPropertyV1 = {
  id: MAPPING_PROFILE_IDS.SHOW_PROPERTY,
  label: 'Show Property v1',
  description:
    'Профиль под rate-card агентств (сезоны high/shoulder/low, Phuket). Обязателен high-season priceDaily.',

  /**
   * @param {object} raw
   * @param {{ rateToThb?: Record<string, number> }} [opts]
   */
  normalizeListing(raw, opts = {}) {
    const base = normalizeConciergeRawListing(raw, opts)
    if (!base.ok) return base

    const seasons = base.listing.seasons || []
    if (seasons.length === 0) {
      return {
        ok: false,
        error: `У объекта ${base.listing.externalId} нет сезонных цен — для show_property_v1 сезоны обязательны`,
        code: 'SEASONS_REQUIRED',
        field: 'seasons',
      }
    }

    const high = seasons.filter(isHighSeasonRow)
    if (high.length === 0) {
      return {
        ok: false,
        error: `Отсутствует цена для высокого сезона в объекте ${base.listing.externalId}`,
        code: 'MISSING_HIGH_SEASON_PRICE',
        field: 'seasons',
      }
    }

    for (const h of high) {
      if (!Number.isFinite(Number(h.priceDaily)) || Number(h.priceDaily) <= 0) {
        return {
          ok: false,
          error: `Отсутствует цена для высокого сезона в объекте ${base.listing.externalId}`,
          code: 'MISSING_HIGH_SEASON_PRICE',
          field: 'seasons',
        }
      }
    }

    const warnings = [...(base.warnings || [])]
    if (!raw.geo?.addressText && !base.listing.geo?.addressText) {
      warnings.push({
        code: 'SHOW_PROPERTY_ADDRESS_HINT',
        message: `Рекомендуется addressText (район Phuket) для ${base.listing.externalId}`,
        field: 'geo.addressText',
      })
    }

    return {
      ok: true,
      listing: {
        ...base.listing,
        categorySlug: base.listing.categorySlug || 'stay',
      },
      warnings,
    }
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

export default showPropertyV1
