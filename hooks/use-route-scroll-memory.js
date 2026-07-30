'use client'

/**
 * Stage 200.17 — restore window scroll after soft back into a remembered route.
 */

import { useEffect, useRef } from 'react'
import {
  consumeRouteScroll,
  saveRouteScroll,
} from '@/lib/navigation/route-scroll-memory'

/**
 * @param {string} routeKey — e.g. listingsCatalogScrollKey(searchParams.toString())
 * @param {{ ready?: boolean }} [opts] — wait until content can accept scroll (not empty skeleton)
 */
export function useRouteScrollMemory(routeKey, opts = {}) {
  const ready = opts.ready !== false
  const restoredRef = useRef(false)
  const keyRef = useRef(routeKey)
  keyRef.current = routeKey

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    try {
      window.history.scrollRestoration = 'manual'
    } catch {
      /* ignore */
    }

    const persist = () => {
      saveRouteScroll(keyRef.current, window.scrollY || 0)
    }

    window.addEventListener('pagehide', persist)
    return () => {
      persist()
      window.removeEventListener('pagehide', persist)
    }
  }, [])

  useEffect(() => {
    restoredRef.current = false
  }, [routeKey])

  useEffect(() => {
    if (!ready || restoredRef.current || typeof window === 'undefined') return
    const y = consumeRouteScroll(routeKey)
    restoredRef.current = true
    if (y == null || y <= 0) return

    const apply = () => {
      window.scrollTo(0, y)
    }
    requestAnimationFrame(() => {
      apply()
      // Layout may shift after images/cards — one follow-up.
      window.setTimeout(apply, 50)
    })
  }, [ready, routeKey])
}
