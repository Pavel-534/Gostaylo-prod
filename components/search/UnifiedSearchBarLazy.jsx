'use client'

/**
 * Stage 201.114a / 201.116 — SSOT lazy `UnifiedSearchBar` for home + catalog.
 * `ssr: true` + fixed skeletons (CLS); calendar stays on-demand via SearchCalendarLazy.
 * FilterBar keeps a static import of UnifiedSearchBar (same chunk as expanded chrome).
 */

import dynamic from 'next/dynamic'
import { HomeSearchBarSkeleton } from '@/components/home/HomeSearchBarSkeleton'

const importUnifiedSearchBar = () =>
  import('@/components/search/UnifiedSearchBar').then((m) => m.UnifiedSearchBar)

export const UnifiedSearchBarHeroLazy = dynamic(importUnifiedSearchBar, {
  ssr: true,
  loading: () => <HomeSearchBarSkeleton variant="hero" />,
})

export const UnifiedSearchBarCompactLazy = dynamic(importUnifiedSearchBar, {
  ssr: true,
  loading: () => <HomeSearchBarSkeleton variant="compact" />,
})

/** Catalog expanded chrome only — prefer via FilterBar chunk; exposed for parity/tests. */
export const UnifiedSearchBarFilterLazy = dynamic(importUnifiedSearchBar, {
  ssr: true,
  loading: () => <HomeSearchBarSkeleton variant="filter" />,
})

/** Warm the search chunk after first paint (home hero / catalog md+). */
export function prefetchUnifiedSearchBarChunk() {
  if (typeof window === 'undefined') return
  void importUnifiedSearchBar()
}
