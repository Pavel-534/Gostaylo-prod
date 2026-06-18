'use client'

import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { boundsParamsReady } from '@/lib/catalog/build-catalog-search-params'
import { fetchMapPins } from '@/lib/catalog/fetch-map-pins'

const MAP_PINS_STALE_MS = 30_000

/**
 * Stage 163.1 — lean map read-path (`GET /api/v2/search/map-pins`).
 *
 * @param {ReturnType<typeof import('@/lib/catalog/build-catalog-search-params').buildCatalogSearchKeyParams> | null} searchKeyParams
 * @param {{ enabled?: boolean }} [options]
 */
export function useMapPinsFetch(searchKeyParams, { enabled = true } = {}) {
  const boundsReady = boundsParamsReady(searchKeyParams?.bounds)
  const keyParams = useMemo(() => {
    if (!searchKeyParams || !boundsReady) return null
    return { ...searchKeyParams, limit: '500' }
  }, [searchKeyParams, boundsReady])

  const query = useQuery({
    queryKey: queryKeys.catalog.mapPins(keyParams),
    queryFn: () => fetchMapPins(keyParams),
    enabled: enabled && Boolean(keyParams),
    placeholderData: keepPreviousData,
    staleTime: MAP_PINS_STALE_MS,
    gcTime: 10 * 60 * 1000,
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
