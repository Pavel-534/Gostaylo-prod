'use client'

import { useQuery } from '@tanstack/react-query'
import { queryFetchJson } from '@/lib/api/query-fetch'
import { queryKeys } from '@/lib/query-keys'
import { mapCategoriesFromApi } from '@/lib/catalog/map-categories-api'
import { CATALOG_CATEGORIES_STALE_MS } from '@/lib/query-prefetch/catalog-query-constants'

async function fetchCategoriesQuery() {
  const data = await queryFetchJson('/api/v2/categories')
  return mapCategoriesFromApi(data)
}

/**
 * Единый кэш категорий для главной и каталога (`queryKeys.public.categories`).
 */
export function usePublicCategoriesQuery() {
  return useQuery({
    queryKey: queryKeys.public.categories(),
    queryFn: fetchCategoriesQuery,
    staleTime: CATALOG_CATEGORIES_STALE_MS,
    gcTime: 30 * 60 * 1000,
  })
}

/** @deprecated Stage 128.2 — alias `usePublicCategoriesQuery`. */
export function useCatalogCategoriesQuery() {
  return usePublicCategoriesQuery()
}

/** @deprecated Stage 128.2 — alias `usePublicCategoriesQuery`. */
export function useHomeCategoriesQuery() {
  return usePublicCategoriesQuery()
}
