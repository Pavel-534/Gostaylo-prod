'use client'

/**
 * Stage 190.6 — live «Show N» for filter draft (ADR-102).
 * Counts via GET /api/v2/search with draft extra filters; does not touch URL SSOT.
 */

import { useEffect, useRef, useState } from 'react'
import { fetchSearchAvailableCount } from '@/lib/api/catalog-public-client'
import { areExtraFiltersEqual } from '@/lib/search/listings-page-url'

/**
 * @param {{
 *   open: boolean,
 *   committedCount?: number,
 *   draftExtraFilters: import('@/lib/search/listings-page-url.js').ListingsExtraFilters,
 *   committedExtraFilters: import('@/lib/search/listings-page-url.js').ListingsExtraFilters,
 *   buildSearchParams?: ((extra: import('@/lib/search/listings-page-url.js').ListingsExtraFilters) => URLSearchParams) | null,
 *   debounceMs?: number,
 * }} options
 */
export function useDraftFilterResultCount({
  open,
  committedCount = 0,
  draftExtraFilters,
  committedExtraFilters,
  buildSearchParams = null,
  debounceMs = 350,
}) {
  const baseline = Math.max(0, Math.round(Number(committedCount) || 0))
  const [count, setCount] = useState(baseline)
  const [loading, setLoading] = useState(false)
  const seqRef = useRef(0)

  useEffect(() => {
    if (!open) {
      setCount(baseline)
      setLoading(false)
      return undefined
    }

    if (!buildSearchParams) {
      setCount(baseline)
      setLoading(false)
      return undefined
    }

    if (areExtraFiltersEqual(draftExtraFilters, committedExtraFilters)) {
      setCount(baseline)
      setLoading(false)
      return undefined
    }

    const seq = ++seqRef.current
    setLoading(true)
    const timer = setTimeout(() => {
      let params
      try {
        params = buildSearchParams(draftExtraFilters)
      } catch {
        if (seq === seqRef.current) {
          setCount(baseline)
          setLoading(false)
        }
        return
      }

      fetchSearchAvailableCount(params)
        .then((res) => {
          if (seq !== seqRef.current) return
          if (res.ok) {
            setCount(Math.max(0, Math.round(Number(res.available) || 0)))
          } else {
            setCount(baseline)
          }
        })
        .catch(() => {
          if (seq !== seqRef.current) return
          setCount(baseline)
        })
        .finally(() => {
          if (seq === seqRef.current) setLoading(false)
        })
    }, debounceMs)

    return () => {
      clearTimeout(timer)
    }
  }, [
    open,
    baseline,
    draftExtraFilters,
    committedExtraFilters,
    buildSearchParams,
    debounceMs,
  ])

  return { count, loading }
}

export default useDraftFilterResultCount
