'use client'

/**
 * ADR-101 Wave 2 — Public Search Chrome shell (expanded in-flow + compact fixed overlay).
 * Writes `--app-search-chrome-height` and `--app-public-top-offset` on `<html>`.
 */

import { useEffect, useRef, useCallback } from 'react'
import { usePublicSearchChrome } from '@/lib/hooks/use-public-search-chrome'
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
  const { phase, isCompact, expandedRef: bindExpandedRef, compactRef } = usePublicSearchChrome({
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

  /** Home: measure active chrome only. */
  useEffect(() => {
    if (!enabled || surface !== 'home') return undefined

    const el = isCompact ? compactRef.current : null
    if (!el) {
      resetPublicChromeCssVars()
      return undefined
    }

    const apply = () => applyPublicChromeCssVars(el.getBoundingClientRect().height)
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(el)
    return () => {
      ro.disconnect()
      resetPublicChromeCssVars()
    }
  }, [enabled, surface, isCompact, compactRef])

  /**
   * Catalog: pre-measure compact + expanded; swap height at phase boundary (no slide geometry).
   */
  useEffect(() => {
    if (!enabled || surface !== 'catalog') return undefined

    let compactH = 0
    let expandedH = 0

    const sync = () => {
      const h = isCompact ? compactH || expandedH : expandedH
      applyPublicChromeCssVars(h)
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
  }, [enabled, surface, isCompact, phase, compactRef])

  if (surface === 'home') {
    return (
      <div data-public-search-chrome={surface} data-chrome-phase={phase} className={className}>
        <div
          ref={compactRef}
          data-testid={compactTestId}
          aria-hidden={!isCompact}
          className={cn(
            'fixed left-0 right-0 app-fixed-below-header z-[120] hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-lg shadow-[0_8px_24px_rgba(0,24,24,0.08)] transition-all duration-300 md:block',
            isCompact
              ? 'translate-y-0 opacity-100'
              : '-translate-y-full opacity-0 pointer-events-none',
          )}
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
      className={cn('bg-white pt-[var(--app-header-height,64px)]', className)}
    >
      <div ref={expandedRef} data-testid="public-search-chrome-expanded">
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
        aria-hidden={!isCompact}
        className={cn(
          'fixed left-0 right-0 app-fixed-below-header z-[120] hidden border-b border-slate-200/80 bg-white/95 backdrop-blur-lg shadow-[0_8px_24px_rgba(0,24,24,0.08)] transition-opacity duration-150 ease-out md:block',
          isCompact ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
        )}
      >
        {compact}
      </div>
    </div>
  )
}

export default PublicSearchChrome
