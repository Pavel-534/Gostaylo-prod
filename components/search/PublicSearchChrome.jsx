'use client'

/**
 * ADR-101 — Public Search Chrome shell (expanded in-flow + compact fixed overlay).
 * Home + catalog desktop: liquid morph via scroll progress (opacity + translate-y).
 * Writes `--app-search-chrome-height` and `--app-public-top-offset` on `<html>`.
 */

import { useEffect, useRef, useCallback } from 'react'
import { usePublicSearchChrome } from '@/lib/hooks/use-public-search-chrome'
import {
  interpolatePublicSearchChromeHeight,
  PUBLIC_SEARCH_CHROME_COMPACT_TRANSLATE_PX,
} from '@/lib/search/public-search-chrome-constants'
import { cn } from '@/lib/utils'

function applyPublicChromeCssVars(heightPx) {
  const h = Math.max(0, Math.ceil(heightPx))
  document.documentElement.style.setProperty('--app-search-chrome-height', `${h}px`)
  document.documentElement.style.setProperty(
    '--app-public-top-offset',
    `calc(var(--app-header-height, 64px) + ${h}px)`,
  )
}

function resetPublicChromeCssVars() {
  document.documentElement.style.setProperty('--app-search-chrome-height', '0px')
  document.documentElement.style.setProperty(
    '--app-public-top-offset',
    'var(--app-header-height, 64px)',
  )
}

/**
 * @param {{
 *   surface: 'home' | 'catalog',
 *   expanded?: React.ReactNode,
 *   compact: React.ReactNode,
 *   enabled?: boolean,
 *   className?: string,
 * }} props
 */
export function PublicSearchChrome({
  surface,
  expanded = null,
  compact,
  enabled = true,
  className,
  compactTestId = 'public-search-chrome-compact',
}) {
  const {
    phase,
    morphProgress,
    morphT,
    expandedRef: bindExpandedRef,
    compactRef,
  } = usePublicSearchChrome({
    surface,
    enabled,
  })

  const expandedMeasureRef = useRef(/** @type {HTMLDivElement | null} */ (null))

  const expandedRef = useCallback(
    (node) => {
      expandedMeasureRef.current = node
      bindExpandedRef(node)
    },
    [bindExpandedRef],
  )

  const compactTranslateY = (1 - morphT) * -PUBLIC_SEARCH_CHROME_COMPACT_TRANSLATE_PX

  const compactMorphStyle = {
    opacity: morphT,
    transform: `translate3d(0, ${compactTranslateY}px, 0)`,
    willChange: 'opacity, transform',
  }

  /**
   * Home: interpolate CSS vars 0 → compact height by morphProgress.
   */
  useEffect(() => {
    if (!enabled || surface !== 'home') return undefined

    let compactH = 0

    const sync = () => {
      applyPublicChromeCssVars(
        interpolatePublicSearchChromeHeight(0, compactH, morphProgress, { fromZero: true }),
      )
    }

    const roCompact = new ResizeObserver((entries) => {
      for (const entry of entries) {
        compactH = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
      }
      sync()
    })

    if (compactRef.current) roCompact.observe(compactRef.current)
    sync()

    return () => {
      roCompact.disconnect()
      resetPublicChromeCssVars()
    }
  }, [enabled, surface, morphProgress, compactRef])

  /**
   * Catalog: interpolate expanded → compact height by morphProgress.
   */
  useEffect(() => {
    if (!enabled || surface !== 'catalog') return undefined

    let compactH = 0
    let expandedH = 0

    const sync = () => {
      applyPublicChromeCssVars(
        interpolatePublicSearchChromeHeight(expandedH, compactH, morphProgress),
      )
    }

    const roCompact = new ResizeObserver((entries) => {
      for (const entry of entries) {
        compactH = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
      }
      sync()
    })

    const roExpanded = new ResizeObserver((entries) => {
      for (const entry of entries) {
        expandedH = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height
      }
      sync()
    })

    if (compactRef.current) roCompact.observe(compactRef.current)
    if (expandedMeasureRef.current) roExpanded.observe(expandedMeasureRef.current)

    sync()

    return () => {
      roCompact.disconnect()
      roExpanded.disconnect()
      resetPublicChromeCssVars()
    }
  }, [enabled, surface, morphProgress, compactRef])

  if (surface === 'home') {
    return (
      <div
        data-public-search-chrome={surface}
        data-chrome-phase={phase}
        data-morph-progress={morphProgress.toFixed(3)}
        data-morph-t={morphT.toFixed(3)}
        className={className}
      >
        <div
          ref={compactRef}
          data-testid={compactTestId}
          aria-hidden={morphT <= 0.01}
          className={cn(
            'fixed left-0 right-0 app-fixed-below-header z-[120] hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-lg shadow-[0_8px_24px_rgba(0,24,24,0.08)] md:block',
            morphT > 0.01 ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          style={compactMorphStyle}
        >
          {compact}
        </div>
      </div>
    )
  }

  return (
    <div
      data-public-search-chrome={surface}
      data-chrome-phase={phase}
      data-morph-progress={morphProgress.toFixed(3)}
      data-morph-t={morphT.toFixed(3)}
      className={cn('bg-white pt-[var(--app-header-height,64px)]', className)}
    >
      <div
        ref={expandedRef}
        data-testid="public-search-chrome-expanded"
        data-public-search-chrome-expanded
        className="will-change-[opacity,transform]"
        style={{
          opacity: 1 - morphT,
          pointerEvents: morphT >= 0.95 ? 'none' : 'auto',
        }}
      >
        {expanded}
      </div>
      <div
        data-testid="public-search-chrome-sentinel"
        className="pointer-events-none h-0 w-full shrink-0 overflow-hidden"
        aria-hidden
      />
      <div
        ref={compactRef}
        data-testid={compactTestId}
        aria-hidden={morphT <= 0.01}
        className={cn(
          'fixed left-0 right-0 app-fixed-below-header z-[120] hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-lg shadow-[0_8px_24px_rgba(0,24,24,0.08)] md:block',
          morphT > 0.01 ? 'pointer-events-auto' : 'pointer-events-none',
        )}
        style={compactMorphStyle}
      >
        {compact}
      </div>
    </div>
  )
}

export default PublicSearchChrome
