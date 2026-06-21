'use client'

/**
 * ADR-101 Wave 2 — scroll phase for Public Search Chrome (home + catalog).
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  PUBLIC_SEARCH_CHROME_HOME_SCROLL_PX,
  PUBLIC_SEARCH_CHROME_CATALOG_IO_THRESHOLD,
  getPublicSearchChromeCatalogIoRootMargin,
  readAppHeaderHeightPx,
} from '@/lib/search/public-search-chrome-constants'

/**
 * @typedef {'expanded' | 'compact'} PublicSearchChromePhase
 * @typedef {'home' | 'catalog'} PublicSearchChromeSurface
 */

/**
 * @param {{ surface: PublicSearchChromeSurface, enabled?: boolean }} options
 */
export function usePublicSearchChrome({ surface, enabled = true }) {
  const [phase, setPhase] = useState(/** @type {PublicSearchChromePhase} */ ('expanded'))
  const expandedRef = useRef(null)
  const compactRef = useRef(null)
  const [expandedEl, setExpandedEl] = useState(/** @type {HTMLElement | null} */ (null))

  const bindExpandedRef = useCallback((node) => {
    expandedRef.current = node
    setExpandedEl(node)
  }, [])

  const isCompact = phase === 'compact'

  /** Home: scrollY threshold (same baseline as legacy StickySearchBar). */
  useEffect(() => {
    if (!enabled || surface !== 'home') return undefined

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setPhase(window.scrollY > PUBLIC_SEARCH_CHROME_HOME_SCROLL_PX ? 'compact' : 'expanded')
        ticking = false
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [surface, enabled])

  /**
   * Catalog (desktop): IO on expanded chrome vs header-bottom line.
   * rootMargin top = -headerHeight → compact when FilterBar bottom clears header.
   */
  useEffect(() => {
    if (!enabled || surface !== 'catalog') return undefined

    const target = expandedEl
    if (!target) return undefined

    const mq = window.matchMedia('(min-width: 768px)')
    const applyExpanded = () => setPhase('expanded')

    if (!mq.matches) {
      applyExpanded()
      return undefined
    }

    let observer = /** @type {IntersectionObserver | null} */ (null)

    const connect = () => {
      observer?.disconnect()
      observer = new IntersectionObserver(
        ([entry]) => {
          setPhase(entry.isIntersecting ? 'expanded' : 'compact')
        },
        {
          root: null,
          rootMargin: getPublicSearchChromeCatalogIoRootMargin(readAppHeaderHeightPx()),
          threshold: PUBLIC_SEARCH_CHROME_CATALOG_IO_THRESHOLD,
        },
      )
      observer.observe(target)
    }

    connect()

    const onMqChange = (e) => {
      if (!e.matches) {
        observer?.disconnect()
        observer = null
        applyExpanded()
        return
      }
      connect()
    }

    const onResize = () => {
      if (!mq.matches) return
      connect()
    }

    mq.addEventListener('change', onMqChange)
    window.addEventListener('resize', onResize, { passive: true })

    return () => {
      observer?.disconnect()
      mq.removeEventListener('change', onMqChange)
      window.removeEventListener('resize', onResize)
    }
  }, [surface, enabled, expandedEl])

  const scrollToExpanded = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return {
    surface,
    phase,
    isCompact,
    expandedRef: bindExpandedRef,
    compactRef,
    scrollToExpanded,
  }
}

export default usePublicSearchChrome
