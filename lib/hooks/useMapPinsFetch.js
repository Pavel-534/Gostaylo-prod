'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { boundsParamsReady } from '@/lib/catalog/build-catalog-search-params'
import { fetchMapPins } from '@/lib/catalog/fetch-map-pins'
import { quantizeMapBbox } from '@/lib/geo/quantize-map-bbox'
import { CATALOG_MAP_BBOX_MIN_FETCH_INTERVAL_MS } from '@/lib/maps/catalog-map-ux-policy'

const MAP_PINS_STALE_MS = 30_000

/**
 * Stage 163.1 — lean map read-path (`GET /api/v2/search/map-pins`).
 *
 * @param {ReturnType<typeof import('@/lib/catalog/build-catalog-search-params').buildCatalogSearchKeyParams> | null} searchKeyParams
 * @param {{ enabled?: boolean }} [options]
 */
export function useMapPinsFetch(searchKeyParams, { enabled = true } = {}) {
  const lastSuccessAtRef = useRef(0)
  const cooldownTimerRef = useRef(null)
  const [cooldownBlocked, setCooldownBlocked] = useState(false)

  const quantizedBounds = useMemo(
    () => quantizeMapBbox(searchKeyParams?.bounds ?? null),
    [searchKeyParams?.bounds],
  )
  const boundsReady = boundsParamsReady(quantizedBounds)
  const keyParams = useMemo(() => {
    if (!searchKeyParams || !boundsReady) return null
    return { ...searchKeyParams, bounds: quantizedBounds, limit: '500' }
  }, [searchKeyParams, boundsReady, quantizedBounds])
  const keyParamsFingerprint = useMemo(() => JSON.stringify(keyParams ?? null), [keyParams])

  useEffect(() => {
    if (!keyParams) {
      setCooldownBlocked(false)
      return
    }
    const elapsedMs = Date.now() - lastSuccessAtRef.current
    const remainingMs = CATALOG_MAP_BBOX_MIN_FETCH_INTERVAL_MS - elapsedMs
    if (remainingMs <= 0) {
      setCooldownBlocked(false)
      return
    }
    setCooldownBlocked(true)
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current)
    cooldownTimerRef.current = setTimeout(() => {
      setCooldownBlocked(false)
      cooldownTimerRef.current = null
    }, remainingMs)
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current)
    }
  }, [keyParamsFingerprint, keyParams])

  const query = useQuery({
    queryKey: queryKeys.catalog.mapPins(keyParams),
    queryFn: () => fetchMapPins(keyParams),
    enabled: enabled && Boolean(keyParams) && !cooldownBlocked,
    placeholderData: keepPreviousData,
    staleTime: MAP_PINS_STALE_MS,
    gcTime: 10 * 60 * 1000,
    onSuccess: () => {
      lastSuccessAtRef.current = Date.now()
    },
  })

  const data = query.data

  return {
    mode: data?.mode ?? 'pins',
    pins: data?.pins ?? [],
    clusters: data?.clusters ?? [],
    meta: data?.meta ?? null,
    isLoading: query.isPending && !query.isPlaceholderData,
    isFetching: query.isFetching,
    error: query.error?.message ?? null,
    refetch: query.refetch,
  }
}
