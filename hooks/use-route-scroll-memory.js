'use client'

/**
 * Stage 200.17 / 201.17 — restore window scroll after soft back into a remembered route.
 *
 * Next App Router often resets scrollY to 0 before the leaving page unmounts.
 * Persist last-known Y on scroll + capture-phase link clicks (not only unmount).
 * Restore with retries until layout is tall enough (home/catalog async grids).
 */

import { useEffect, useRef } from 'react'
import {
  consumeRouteScroll,
  peekRouteScroll,
  saveRouteScroll,
} from '@/lib/navigation/route-scroll-memory'

const RESTORE_RETRY_MS = 100
const RESTORE_BUDGET_MS = 1800

/**
 * @param {string} routeKey — e.g. listingsCatalogScrollKey(searchParams.toString())
 * @param {{ ready?: boolean }} [opts] — wait until content can accept scroll (not empty skeleton)
 */
export function useRouteScrollMemory(routeKey, opts = {}) {
  const ready = opts.ready !== false
  const restoredRef = useRef(false)
  const keyRef = useRef(routeKey)
  const lastYRef = useRef(0)
  keyRef.current = routeKey

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    try {
      window.history.scrollRestoration = 'manual'
    } catch {
      /* ignore */
    }

    lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))

    const persist = () => {
      saveRouteScroll(keyRef.current, lastYRef.current)
    }

    const onScroll = () => {
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
    }

    /** Save before Next zeroes scroll on soft navigation. */
    const onClickCapture = (event) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (target.getAttribute('target') === '_blank') return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      let nextUrl = null
      try {
        nextUrl = new URL(href, window.location.href)
      } catch {
        return
      }
      if (nextUrl.origin !== window.location.origin) return
      if (
        nextUrl.pathname === window.location.pathname &&
        nextUrl.search === window.location.search
      ) {
        return
      }
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
      persist()
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', persist)
    document.addEventListener('click', onClickCapture, true)

    return () => {
      persist()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', persist)
      document.removeEventListener('click', onClickCapture, true)
    }
  }, [])

  useEffect(() => {
    restoredRef.current = false
  }, [routeKey])

  useEffect(() => {
    if (!ready || restoredRef.current || typeof window === 'undefined') return undefined

    const y = peekRouteScroll(routeKey)
    if (y == null || y <= 0) {
      restoredRef.current = true
      return undefined
    }

    let cancelled = false
    const startedAt = Date.now()

    const tryRestore = () => {
      if (cancelled) return true
      const maxScroll = Math.max(
        0,
        (document.documentElement?.scrollHeight || 0) - window.innerHeight,
      )
      window.scrollTo(0, y)
      const layoutReady = maxScroll >= y - 24
      const budgetExceeded = Date.now() - startedAt >= RESTORE_BUDGET_MS
      if (!layoutReady && !budgetExceeded) return false

      consumeRouteScroll(routeKey)
      restoredRef.current = true
      window.scrollTo(0, y)
      return true
    }

    if (tryRestore()) return undefined

    const intervalId = window.setInterval(() => {
      if (tryRestore()) window.clearInterval(intervalId)
    }, RESTORE_RETRY_MS)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [ready, routeKey])
}
