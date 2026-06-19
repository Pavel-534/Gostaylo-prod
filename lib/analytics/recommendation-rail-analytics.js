'use client'

/**
 * Stage 169.0 — SSOT for discovery rail telemetry (ADR-169 §3).
 * Impression via IntersectionObserver; click via trackRecommendationClick.
 */

import { useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'

/** ADR-169 §3.3 — allowed surface values (dev guard only). */
export const RECOMMENDATION_SURFACES = Object.freeze([
  'for_you_home',
  'for_you_catalog',
  'similar_pdp',
  'recent_pdp',
  'recent_home',
])

const DEDUPE_PREFIX = 'gsl_rec_imp_'
const LISTING_IDS_CAP = 12
const IO_THRESHOLD = 0.5

function buildDedupeKey(surface, pathname, anchorListingId, dedupeExtra) {
  return [DEDUPE_PREFIX, surface, pathname || '', anchorListingId || '', dedupeExtra || ''].join('|')
}

function hasSentImpression(key) {
  if (typeof window === 'undefined') return false
  try {
    return sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markImpressionSent(key) {
  try {
    sessionStorage.setItem(key, '1')
  } catch {
    /* private mode / quota */
  }
}

function extractListingIds(listings) {
  return (listings || [])
    .slice(0, LISTING_IDS_CAP)
    .map((row) => String(row?.id ?? '').trim())
    .filter(Boolean)
}

function buildImpressionPayload({ surface, listings, meta, anchorListingId }) {
  const payload = {
    surface,
    count: listings.length,
    listing_ids: extractListingIds(listings),
  }
  if (meta?.mode != null) payload.mode = meta.mode
  if (meta?.authenticated === true) payload.authenticated = true
  const anchor = String(anchorListingId ?? '').trim()
  if (anchor) payload.anchor_listing_id = anchor
  return payload
}

/**
 * Sync click helper — call in Link onClick before navigation.
 *
 * @param {object} input
 * @param {string} input.surface — ADR-169 §3.3
 * @param {string} input.listingId
 * @param {number} [input.position] — 0-based index in rail
 * @param {object} [input.meta] — { mode, authenticated, … }
 * @param {string} [input.anchorListingId]
 */
export function trackRecommendationClick({
  surface,
  listingId,
  position,
  meta,
  anchorListingId,
}) {
  const sid = String(surface ?? '').trim()
  const lid = String(listingId ?? '').trim()
  if (!sid || !lid) return

  if (process.env.NODE_ENV !== 'production' && !RECOMMENDATION_SURFACES.includes(sid)) {
    console.warn('[recommendation-rail-analytics] unknown surface:', sid)
  }

  const payload = {
    surface: sid,
    listing_id: lid,
  }
  if (Number.isFinite(position)) payload.position = position
  if (meta?.mode != null) payload.mode = meta.mode
  const anchor = String(anchorListingId ?? '').trim()
  if (anchor) payload.anchor_listing_id = anchor

  void trackProductEvent(ProductAnalyticsEvents.RECOMMENDATION_CLICK, payload)
}

/**
 * @param {object} opts
 * @param {string} opts.surface
 * @param {object[]} opts.listings
 * @param {object} [opts.meta]
 * @param {string} [opts.anchorListingId]
 * @param {import('react').RefObject<HTMLElement | null>} opts.containerRef
 * @param {number} [opts.minVisible=1]
 * @param {boolean} [opts.enabled=true] — false while loading / hidden rail
 * @param {string} [opts.dedupeExtra] — e.g. catalog `where` for for_you_catalog
 */
export function useRecommendationRailAnalytics({
  surface,
  listings = [],
  meta = null,
  anchorListingId = null,
  containerRef,
  minVisible = 1,
  enabled = true,
  dedupeExtra = null,
}) {
  const pathname = usePathname()

  const listingCount = listings?.length ?? 0
  const listingIdsKey = useMemo(() => extractListingIds(listings).join(','), [listings])
  const mode = meta?.mode ?? null
  const authenticated = meta?.authenticated === true

  useEffect(() => {
    if (!enabled || !surface) return
    if (listingCount === 0 || listingCount < minVisible) return

    const dedupeKey = buildDedupeKey(surface, pathname, anchorListingId, dedupeExtra)
    if (hasSentImpression(dedupeKey)) return

    const payload = buildImpressionPayload({
      surface,
      listings,
      meta: { mode, authenticated },
      anchorListingId,
    })

    let observer = null
    let rafId = 0
    let cancelled = false

    const fireImpression = () => {
      if (cancelled || hasSentImpression(dedupeKey)) return true
      markImpressionSent(dedupeKey)
      void trackProductEvent(ProductAnalyticsEvents.RECOMMENDATION_IMPRESSION, payload)
      return true
    }

    const attach = () => {
      if (cancelled) return
      const el = containerRef?.current
      if (!el) {
        rafId = requestAnimationFrame(attach)
        return
      }

      const rect = el.getBoundingClientRect()
      if (rect.height > 0) {
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight
        const visiblePx = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
        const ratio = visiblePx / rect.height
        if (ratio >= IO_THRESHOLD && fireImpression()) return
      }

      observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry?.isIntersecting || entry.intersectionRatio < IO_THRESHOLD) return
          if (fireImpression()) observer?.disconnect()
        },
        { threshold: IO_THRESHOLD },
      )
      observer.observe(el)
    }

    attach()

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
      observer?.disconnect()
    }
  }, [
    surface,
    listingCount,
    listingIdsKey,
    minVisible,
    enabled,
    pathname,
    anchorListingId,
    dedupeExtra,
    mode,
    authenticated,
    containerRef,
    listings,
  ])
}
