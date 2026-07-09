'use client'

/**
 * ADR-101 Wave 1 — Public search filter state SSOT (home + catalog).
 * URL contract: `lib/search/listings-page-url.js`
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { isTransportIntervalWizardProfile } from '@/lib/config/category-wizard-profile-db'
import { effectiveCategoryWizardProfileRaw } from '@/lib/config/category-hierarchy'
import { useDebounce } from '@/hooks/use-debounce'
import { fetchSiteFeatures } from '@/lib/api/catalog-public-client'
import { isCatalogTransportIntervalMode } from '@/lib/search/catalog-transport-interval'
import {
  buildPublicSearchParams,
  canonicalPublicSearchWhere,
  parsePublicSearchFiltersFromParams,
  serializePublicSearchQuery,
} from '@/lib/search/listings-page-url'

/**
 * @typedef {'home' | 'catalog'} PublicSearchSurface
 */

/**
 * @typedef {Object} UsePublicSearchFiltersOptions
 * @property {PublicSearchSurface} surface
 * @property {Array<{ slug?: string, wizardProfile?: string | null }>} [categoriesFromApi]
 * @property {Record<string, string | null | undefined>} [wizardProfileBySlug] — catalog transport interval map
 * @property {{ extraFilters?: import('@/lib/search/listings-page-url.js').ListingsExtraFilters | null, appliedBbox?: object | null, catalogSort?: string | null }} [urlCommitExtras] — catalog-only; merged into URL pushes
 */

/**
 * @param {UsePublicSearchFiltersOptions} options
 */
export function usePublicSearchFilters({
  surface = 'home',
  categoriesFromApi = [],
  wizardProfileBySlug = null,
  urlCommitExtras = null,
} = {}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const searchParamsKey = searchParams.toString()

  const initialSnapshot = useMemo(
    () => parsePublicSearchFiltersFromParams(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot only for first render
    [],
  )

  const [selectedCategory, setSelectedCategory] = useState(initialSnapshot.selectedCategory)
  const [where, setWhereState] = useState(initialSnapshot.where)
  const [dateRange, setDateRange] = useState(initialSnapshot.dateRange)
  const [checkInTime, setCheckInTime] = useState(initialSnapshot.checkInTime)
  const [checkOutTime, setCheckOutTime] = useState(initialSnapshot.checkOutTime)
  const [guests, setGuests] = useState(initialSnapshot.guests)
  const [guestsBreakdown, setGuestsBreakdown] = useState(initialSnapshot.guestsBreakdown)
  const [searchQuery, setSearchQuery] = useState(initialSnapshot.textQuery)
  const [smartSearchOn, setSmartSearchOn] = useState(initialSnapshot.smartSearchOn)
  const [semanticSiteEnabled, setSemanticSiteEnabled] = useState(true)

  const pendingHomeSemanticRef = useRef(false)
  const [aiGridPending, setAiGridPending] = useState(false)

  const lastPushedSearchRef = useRef('')
  const urlSyncDidMountRef = useRef(false)
  const skipNextUrlPushRef = useRef(false)

  const setWhere = useCallback((w) => setWhereState(canonicalPublicSearchWhere(w)), [])

  const debouncedDateRange = useDebounce(dateRange, 500)
  const debouncedWhere = useDebounce(where, 300)
  const debouncedGuests = useDebounce(guests, 300)
  const debouncedSearchQuery = useDebounce(searchQuery, 400)

  const transportSearchMode = useMemo(() => {
    const eff = effectiveCategoryWizardProfileRaw(selectedCategory, categoriesFromApi)
    return isTransportIntervalWizardProfile(eff, selectedCategory)
  }, [categoriesFromApi, selectedCategory])

  const filterSnapshot = useMemo(
    () => ({
      selectedCategory,
      where,
      dateRange,
      checkInTime,
      checkOutTime,
      guests,
      guestsBreakdown,
      textQuery: searchQuery,
      smartSearchOn,
    }),
    [
      selectedCategory,
      where,
      dateRange,
      checkInTime,
      checkOutTime,
      guests,
      guestsBreakdown,
      searchQuery,
      smartSearchOn,
    ],
  )

  const debouncedFilterSnapshot = useMemo(
    () => ({
      selectedCategory,
      where: debouncedWhere,
      dateRange: debouncedDateRange,
      checkInTime,
      checkOutTime,
      guests: debouncedGuests,
      guestsBreakdown,
      textQuery: debouncedSearchQuery,
      smartSearchOn,
    }),
    [
      selectedCategory,
      debouncedWhere,
      debouncedDateRange,
      checkInTime,
      checkOutTime,
      debouncedGuests,
      guestsBreakdown,
      debouncedSearchQuery,
      smartSearchOn,
    ],
  )

  const resolveBuildOptions = useCallback(
    (overrides = {}) => {
      const extras = { ...urlCommitExtras, ...overrides }
      const categoryForTransport = selectedCategory
      const transportIntervalMode =
        surface === 'home'
          ? transportSearchMode
          : isCatalogTransportIntervalMode(categoryForTransport, wizardProfileBySlug)

      return {
        includeSemantic: surface === 'home' || Boolean(extras.includeSemantic),
        semanticSiteEnabled,
        transportIntervalMode,
        omitSameDayCheckout: surface === 'home',
        extraFilters: extras.extraFilters ?? null,
        appliedBbox: extras.appliedBbox ?? null,
        catalogSort: extras.catalogSort ?? null,
      }
    },
    [
      urlCommitExtras,
      selectedCategory,
      surface,
      transportSearchMode,
      wizardProfileBySlug,
      semanticSiteEnabled,
    ],
  )

  /** Записать текущие фильтры в адресную строку (catalog: replace; home: push на /listings). */
  const commitToUrl = useCallback(
    (overrides = {}) => {
      const useDebounced = overrides.useDebounced === true
      const snapshot =
        overrides.snapshot ?? (useDebounced ? debouncedFilterSnapshot : filterSnapshot)
      const buildOptions = resolveBuildOptions(overrides)

      if (surface === 'home') {
        const params = buildPublicSearchParams(snapshot, {
          ...buildOptions,
          includeSemantic: true,
        })
        const qs = params.toString()
        router.push(qs ? `/listings?${qs}` : '/listings')
        return qs
      }

      const params = buildPublicSearchParams(snapshot, buildOptions)
      const qs = params.toString()
      if (qs === lastPushedSearchRef.current) return qs
      lastPushedSearchRef.current = qs
      skipNextUrlPushRef.current = true
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      return qs
    },
    [
      surface,
      filterSnapshot,
      debouncedFilterSnapshot,
      resolveBuildOptions,
      router,
      pathname,
    ],
  )

  /** Переход на каталог с полным набором параметров (главная → /listings). */
  const navigateToCatalog = useCallback(() => {
    const params = buildPublicSearchParams(filterSnapshot, {
      ...resolveBuildOptions(),
      includeSemantic: true,
    })
    const qs = params.toString()
    router.push(qs ? `/listings?${qs}` : '/listings')
    return qs
  }, [filterSnapshot, resolveBuildOptions, router])

  /** Применить snapshot из URL к React state. */
  const applySnapshotFromParams = useCallback((sp) => {
    const next = parsePublicSearchFiltersFromParams(sp)
    setSelectedCategory(next.selectedCategory)
    setWhereState(next.where)
    setDateRange(next.dateRange)
    setCheckInTime(next.checkInTime)
    setCheckOutTime(next.checkOutTime)
    setGuests(next.guests)
    setGuestsBreakdown(next.guestsBreakdown)
    setSearchQuery(next.textQuery)
    setSmartSearchOn(next.smartSearchOn)
  }, [])

  // Home: однократный seed из URL (back / shared link на /?…)
  useEffect(() => {
    if (surface !== 'home') return
    applySnapshotFromParams(searchParams)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only seed, как legacy useHomeFilters
  }, [])

  // Catalog: синхронизация state ← URL при back/forward и внешних replace
  useEffect(() => {
    if (surface !== 'catalog') return
    if (!urlSyncDidMountRef.current) {
      urlSyncDidMountRef.current = true
      lastPushedSearchRef.current = searchParamsKey
      skipNextUrlPushRef.current = true
      return
    }
    applySnapshotFromParams(searchParams)
  }, [surface, searchParamsKey, searchParams, applySnapshotFromParams])

  // Catalog: debounced state → URL (replace)
  useEffect(() => {
    if (surface !== 'catalog') return
    if (skipNextUrlPushRef.current) {
      skipNextUrlPushRef.current = false
      return
    }

    const qs = serializePublicSearchQuery(debouncedFilterSnapshot, resolveBuildOptions())
    if (qs === lastPushedSearchRef.current) return
    lastPushedSearchRef.current = qs
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [
    surface,
    debouncedFilterSnapshot,
    resolveBuildOptions,
    router,
    pathname,
    urlCommitExtras,
  ])

  useEffect(() => {
    fetchSiteFeatures()
      .then(({ ok, semanticSearchOnSite }) => {
        if (ok && typeof semanticSearchOnSite === 'boolean') {
          setSemanticSiteEnabled(semanticSearchOnSite)
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const total = Math.max(1, parseInt(guests, 10) || 1)
    const currentTotal =
      Math.max(1, parseInt(guestsBreakdown?.adults, 10) || 1) +
      Math.max(0, parseInt(guestsBreakdown?.children, 10) || 0) +
      Math.max(0, parseInt(guestsBreakdown?.infants, 10) || 0)
    if (currentTotal === total) return
    setGuestsBreakdown({ adults: total, children: 0, infants: 0 })
  }, [guests, guestsBreakdown])

  return {
    surface,
    selectedCategory,
    setSelectedCategory,
    where,
    setWhere,
    dateRange,
    setDateRange,
    checkInTime,
    setCheckInTime,
    checkOutTime,
    setCheckOutTime,
    guests,
    setGuests,
    guestsBreakdown,
    setGuestsBreakdown,
    searchQuery,
    setSearchQuery,
    smartSearchOn,
    setSmartSearchOn,
    semanticSiteEnabled,
    pendingHomeSemanticRef,
    aiGridPending,
    setAiGridPending,
    debouncedDateRange,
    debouncedWhere,
    debouncedGuests,
    debouncedSearchQuery,
    transportSearchMode,
    filterSnapshot,
    debouncedFilterSnapshot,
    commitToUrl,
    navigateToCatalog,
    applySnapshotFromParams,
    /** @deprecated catalog-internal — для гидрации bbox/extra на mount */
    markUrlPushSkipped: () => {
      skipNextUrlPushRef.current = true
    },
    syncLastPushedQuery: (qs) => {
      lastPushedSearchRef.current = qs
    },
  }
}

export default usePublicSearchFilters
