'use client'

/**
 * Stage 200.39 — listing location label: sync seed/metadata first, then enrich via geo API.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  formatListingLocationLineSync,
  listingLocationNeedsGeoEnrichment,
  resolveListingLocationPartsSync,
} from '@/lib/locations/geo-display-label'

/**
 * @param {object|null|undefined} listing
 * @param {string} [language]
 * @returns {string}
 */
export function useListingLocationLabel(listing, language = 'ru') {
  const syncLabel = useMemo(
    () => formatListingLocationLineSync(listing, language),
    [listing, language],
  )
  const [label, setLabel] = useState(syncLabel)

  useEffect(() => {
    setLabel(syncLabel)
    if (!listing || typeof listing !== 'object') return undefined

    if (!listingLocationNeedsGeoEnrichment(listing, language)) return undefined
    const parts = resolveListingLocationPartsSync(listing, language)

    let cancelled = false
    const params = new URLSearchParams()
    params.set('lang', language)
    if (parts.countryCode) params.set('country', parts.countryCode)
    if (parts.regionCode) params.set('region', parts.regionCode)
    if (parts.cityCode) params.set('city', parts.cityCode)
    if (parts.district) params.set('district', parts.district)
    if (parts.cityLabel) params.set('cityLabel', parts.cityLabel)

    ;(async () => {
      try {
        const res = await fetch(`/api/v2/geo/listing-label?${params}`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        const next = json?.data?.label
        if (typeof next === 'string' && next.trim()) setLabel(next.trim())
      } catch {
        /* keep sync */
      }
    })()

    return () => {
      cancelled = true
    }
  }, [listing, language, syncLabel])

  return label
}
