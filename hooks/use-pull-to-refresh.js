'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/hooks/use-mobile'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEFAULT_THRESHOLD = 70
const MAX_PULL = 120

function readScrollTop(scrollEl) {
  if (!scrollEl || scrollEl === window) {
    return window.scrollY || document.documentElement.scrollTop || 0
  }
  return scrollEl.scrollTop || 0
}

/**
 * Mobile pull-to-refresh for window or a scroll container (Stage 200.67).
 * Desktop: no listeners / zero layout impact when inactive.
 *
 * @param {{
 *   onRefresh: () => void | Promise<void>,
 *   threshold?: number,
 *   enabled?: boolean,
 *   scrollRef?: { current: Element | null },
 *   scrollEl?: Element | null,
 * }} options
 */
export function usePullToRefresh({
  onRefresh,
  threshold = DEFAULT_THRESHOLD,
  enabled,
  scrollRef = null,
  scrollEl = null,
} = {}) {
  const isMobile = useIsMobile()
  const active = enabled ?? isMobile
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const startYRef = useRef(0)
  const pullingRef = useRef(false)
  const distanceRef = useRef(0)
  const refreshingRef = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  const resolvedScrollEl = scrollEl ?? scrollRef?.current ?? null

  const reset = useCallback(() => {
    pullingRef.current = false
    distanceRef.current = 0
    setPullDistance(0)
  }, [])

  useEffect(() => {
    if (!active) return undefined

    const getScrollEl = () => resolvedScrollEl || window

    const onTouchStart = (e) => {
      if (refreshingRef.current) return
      if (readScrollTop(getScrollEl()) > 0) {
        pullingRef.current = false
        return
      }
      startYRef.current = e.touches?.[0]?.clientY ?? 0
      pullingRef.current = true
      distanceRef.current = 0
    }

    const onTouchMove = (e) => {
      if (!pullingRef.current || refreshingRef.current) return
      if (readScrollTop(getScrollEl()) > 0) {
        reset()
        return
      }
      const y = e.touches?.[0]?.clientY ?? 0
      const delta = y - startYRef.current
      if (delta <= 0) {
        distanceRef.current = 0
        setPullDistance(0)
        return
      }
      const dampened = Math.min(MAX_PULL, delta * 0.55)
      distanceRef.current = dampened
      setPullDistance(dampened)
      if (dampened > 8 && e.cancelable) {
        e.preventDefault()
      }
    }

    const onTouchEnd = () => {
      if (!pullingRef.current || refreshingRef.current) return
      pullingRef.current = false
      const distance = distanceRef.current
      if (distance < threshold) {
        distanceRef.current = 0
        setPullDistance(0)
        return
      }
      refreshingRef.current = true
      setRefreshing(true)
      setPullDistance(threshold)
      Promise.resolve()
        .then(() => onRefreshRef.current?.())
        .catch(() => {})
        .finally(() => {
          refreshingRef.current = false
          setRefreshing(false)
          distanceRef.current = 0
          setPullDistance(0)
        })
    }

    const target = resolvedScrollEl || document
    target.addEventListener('touchstart', onTouchStart, { passive: true })
    target.addEventListener('touchmove', onTouchMove, { passive: false })
    target.addEventListener('touchend', onTouchEnd, { passive: true })
    target.addEventListener('touchcancel', reset, { passive: true })

    return () => {
      target.removeEventListener('touchstart', onTouchStart)
      target.removeEventListener('touchmove', onTouchMove)
      target.removeEventListener('touchend', onTouchEnd)
      target.removeEventListener('touchcancel', reset)
    }
  }, [active, threshold, resolvedScrollEl, reset])

  const progress = Math.min(1, pullDistance / threshold)
  const armed = pullDistance >= threshold

  const indicator = active ? (
    <div
      className={cn(
        'pointer-events-none sticky top-0 z-30 flex items-center justify-center overflow-hidden transition-[height] duration-150 sm:hidden',
        refreshing || pullDistance > 0 ? 'opacity-100' : 'opacity-0',
      )}
      style={{ height: refreshing ? 44 : Math.max(0, pullDistance * 0.85) }}
      aria-hidden={!refreshing && pullDistance <= 0}
      role="status"
    >
      <div
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-sm',
          armed || refreshing ? 'border-brand text-brand' : 'border-slate-200 text-slate-400',
        )}
        style={{
          transform: refreshing ? undefined : `rotate(${progress * 180}deg)`,
        }}
      >
        <Loader2 className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden />
      </div>
    </div>
  ) : null

  return {
    active,
    pullDistance,
    refreshing,
    armed,
    indicator,
  }
}

export default usePullToRefresh
