'use client'

/**
 * @deprecated ADR-101 — thin wrapper; SSOT: `usePublicSearchFilters` (`lib/hooks/use-public-search-filters.js`).
 * Home surface: `usePublicSearchFilters({ surface: 'home', categoriesFromApi })`.
 */
import { usePublicSearchFilters } from '@/lib/hooks/use-public-search-filters'

/**
 * Home search filters: What / Where / When / Who, URL seed, smart search toggles.
 * @param {Array<{ slug?: string, wizardProfile?: string | null }>} [categoriesFromApi]
 */
export function useHomeFilters(categoriesFromApi = []) {
  return usePublicSearchFilters({ surface: 'home', categoriesFromApi })
}

export default useHomeFilters
