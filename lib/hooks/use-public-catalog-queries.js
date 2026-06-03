'use client'

import { useQuery } from '@tanstack/react-query'
import { queryFetchJson } from '@/lib/api/query-fetch'
import { queryKeys } from '@/lib/query-keys'
import { mapCategoriesFromApi } from '@/lib/catalog/map-categories-api'

const CATEGORIES_STALE_MS = 5 * 60 * 1000

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
    staleTime: CATEGORIES_STALE_MS,
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
