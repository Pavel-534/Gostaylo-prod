'use client'

/**
 * ADR-101 — scroll morph SSOT for Public Search Chrome (home + catalog).
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  PUBLIC_SEARCH_CHROME_CATALOG_MORPH_START,
  PUBLIC_SEARCH_CHROME_HOME_MORPH_START,
  PUBLIC_SEARCH_CHROME_HOME_EXPANDED_SELECTOR,
  computePublicSearchScrollProgress,
  computePublicSearchMorphVisualT,
  readAppHeaderHeightPx,
} from '@/lib/search/public-search-chrome-constants'

/**
 * @typedef {'expanded' | 'compact'} PublicSearchChromePhase
 * @typedef {'home' | 'catalog'} PublicSearchChromeSurface
 */

/**
 * @param {HTMLElement | null} target
 * @param {React.MutableRefObject<number>} heightRef
 */
function measureExpandedHeight(target, heightRef) {
  if (!target) return
  heightRef.current = target.getBoundingClientRect().height
}

/**
 * @param {HTMLElement} target
 * @param {React.MutableRefObject<number>} heightRef
 */
function readScrollProgress(target, heightRef) {
  const headerPx = readAppHeaderHeightPx()
  return computePublicSearchScrollProgress(
    target.getBoundingClientRect().bottom,
    headerPx,
    heightRef.current,
  )
}

/**
 * @param {{ surface: PublicSearchChromeSurface, enabled?: boolean }} options
 */
export function usePublicSearchChrome({ surface, enabled = true }) {
  const [phase, setPhase] = useState(/** @type {PublicSearchChromePhase} */ ('expanded'))
  const [morphProgress, setMorphProgress] = useState(0)
  const expandedRef = useRef(null)
  const compactRef = useRef(null)
  const expandedHeightRef = useRef(0)
  const [expandedEl, setExpandedEl] = useState(/** @type {HTMLElement | null} */ (null))

  const bindExpandedRef = useCallback((node) => {
    expandedRef.current = node
    setExpandedEl(node)
  }, [])

  const morphStart =
    surface === 'home' ? PUBLIC_SEARCH_CHROME_HOME_MORPH_START : PUBLIC_SEARCH_CHROME_CATALOG_MORPH_START

  const morphT = useMemo(
    () => computePublicSearchMorphVisualT(morphProgress, morphStart),
    [morphProgress, morphStart],
  )

  const isCompact = morphProgress >= 1

  /** Catalog (desktop): morph vs in-flow FilterBar ref. */
  useEffect(() => {
    if (!enabled || surface !== 'catalog') return undefined

    const target = expandedEl
    if (!target) return undefined

    const mq = window.matchMedia('(min-width: 768px)')

    const resetMorph = () => {
      setMorphProgress(0)
      setPhase('expanded')
    }

    if (!mq.matches) {
      resetMorph()
      return undefined
    }

    let raf = 0

    measureExpandedHeight(target, expandedHeightRef)
    const ro = new ResizeObserver(() => measureExpandedHeight(target, expandedHeightRef))
    ro.observe(target)

    const update = () => {
      const progress = readScrollProgress(target, expandedHeightRef)
      setMorphProgress(progress)
      setPhase(progress >= 1 ? 'compact' : 'expanded')
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate, { passive: true })

    const onMqChange = (e) => {
      if (!e.matches) {
        ro.disconnect()
        cancelAnimationFrame(raf)
        resetMorph()
        return
      }
      measureExpandedHeight(target, expandedHeightRef)
      ro.observe(target)
      scheduleUpdate()
    }

    mq.addEventListener('change', onMqChange)

    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
      mq.removeEventListener('change', onMqChange)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [surface, enabled, expandedEl])

  /** Home (desktop): morph vs HomeHeroLuxe glass capsule anchor. */
  useEffect(() => {
    if (!enabled || surface !== 'home') return undefined

    const mq = window.matchMedia('(min-width: 768px)')

    const resetMorph = () => {
      setMorphProgress(0)
      setPhase('expanded')
    }

    if (!mq.matches) {
      resetMorph()
      return undefined
    }

    let raf = 0
    let ro = /** @type {ResizeObserver | null} */ (null)
    let observed = /** @type {HTMLElement | null} */ (null)

    const disconnectRo = () => {
      ro?.disconnect()
      ro = null
      observed = null
    }

    const resolveTarget = () =>
      document.querySelector(PUBLIC_SEARCH_CHROME_HOME_EXPANDED_SELECTOR)

    const ensureObserved = () => {
      const target = resolveTarget()
      if (!target) return null
      if (target === observed) return target
      disconnectRo()
      observed = target
      measureExpandedHeight(target, expandedHeightRef)
      ro = new ResizeObserver(() => measureExpandedHeight(target, expandedHeightRef))
      ro.observe(target)
      return target
    }

    const update = () => {
      const target = ensureObserved()
      if (!target) {
        resetMorph()
        return
      }
      const progress = readScrollProgress(target, expandedHeightRef)
      setMorphProgress(progress)
      setPhase(progress >= 1 ? 'compact' : 'expanded')
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(update)
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate, { passive: true })

    const onMqChange = (e) => {
      if (!e.matches) {
        disconnectRo()
        cancelAnimationFrame(raf)
        resetMorph()
        return
      }
      scheduleUpdate()
    }

    mq.addEventListener('change', onMqChange)

    return () => {
      disconnectRo()
      cancelAnimationFrame(raf)
      mq.removeEventListener('change', onMqChange)
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [surface, enabled])

  const scrollToExpanded = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return {
    surface,
    phase,
    isCompact,
    morphProgress,
    morphT,
    morphStart,
    expandedRef: bindExpandedRef,
    compactRef,
    scrollToExpanded,
  }
}

export default usePublicSearchChrome
