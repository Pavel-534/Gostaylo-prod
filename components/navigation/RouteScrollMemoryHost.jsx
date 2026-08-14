'use client'

/**
 * Stage 201.18 / 201.20 — app-wide scroll memory (root host).
 * Anchor-based restore so image/layout growth does not land “a bit lower”.
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  applyRouteScrollEntry,
  consumePendingRouteScrollRestore,
  consumeRouteScrollEntry,
  findScrollAnchorElement,
  peekRouteScrollEntry,
  routeScrollKeyFromLocation,
  saveRouteScroll,
} from '@/lib/navigation/route-scroll-memory'

const RESTORE_RETRY_MS = 80
const RESTORE_BUDGET_MS = 2800
const ANCHOR_TOLERANCE_PX = 12

function readSearchKey() {
  if (typeof window === 'undefined') return ''
  return String(window.location.search || '').replace(/^\?/, '')
}

export function RouteScrollMemoryHost() {
  const pathname = usePathname()
  const [searchKey, setSearchKey] = useState('')
  const routeKey = routeScrollKeyFromLocation(pathname, searchKey)

  const routeKeyRef = useRef(routeKey)
  const lastYRef = useRef(0)
  const pendingPopRestoreRef = useRef(false)
  const restoreTimerRef = useRef(null)

  useEffect(() => {
    setSearchKey(readSearchKey())
  }, [pathname])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    try {
      window.history.scrollRestoration = 'manual'
    } catch {
      /* ignore */
    }

    lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
    setSearchKey(readSearchKey())

    const persistCurrent = (extra = null) => {
      const key = routeKeyRef.current
      if (!key) return
      const y = Math.max(0, Math.round(lastYRef.current || window.scrollY || 0))
      if (extra && extra.anchorHref) {
        saveRouteScroll(key, { y, ...extra })
        return
      }
      if (y > 0) saveRouteScroll(key, y)
    }

    const onScroll = () => {
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
    }

    const onPopState = () => {
      pendingPopRestoreRef.current = true
      setSearchKey(readSearchKey())
    }

    const onClickCapture = (event) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (target.getAttribute('target') === '_blank') return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
      const rect = target.getBoundingClientRect()
      persistCurrent({
        anchorHref: href,
        anchorTop: Math.round(rect.top),
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('popstate', onPopState)
    const onPageHide = () => persistCurrent()
    window.addEventListener('pagehide', onPageHide)
    document.addEventListener('click', onClickCapture, true)

    return () => {
      persistCurrent()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('pagehide', onPageHide)
      document.removeEventListener('click', onClickCapture, true)
      if (restoreTimerRef.current) {
        window.clearInterval(restoreTimerRef.current)
        restoreTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const prevKey = routeKeyRef.current
    const nextKey = routeScrollKeyFromLocation(pathname, searchKey)

    if (prevKey && prevKey !== nextKey) {
      const y = Math.max(0, Math.round(lastYRef.current || 0))
      if (y > 0) saveRouteScroll(prevKey, y)
    }
    routeKeyRef.current = nextKey

    if (restoreTimerRef.current) {
      window.clearInterval(restoreTimerRef.current)
      restoreTimerRef.current = null
    }

    const shouldRestore =
      (pendingPopRestoreRef.current || consumePendingRouteScrollRestore()) && Boolean(nextKey)
    pendingPopRestoreRef.current = false

    if (!shouldRestore || !nextKey) {
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
      return undefined
    }

    const entry = peekRouteScrollEntry(nextKey)
    if (!entry || (entry.y <= 0 && !entry.anchorHref)) {
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
      return undefined
    }

    let cancelled = false
    const startedAt = Date.now()

    const isAnchorStable = () => {
      if (!entry.anchorHref || !Number.isFinite(Number(entry.anchorTop))) return false
      const el = findScrollAnchorElement(entry.anchorHref)
      if (!el) return false
      return Math.abs(el.getBoundingClientRect().top - Number(entry.anchorTop)) <= ANCHOR_TOLERANCE_PX
    }

    const tryRestore = () => {
      if (cancelled) return true
      applyRouteScrollEntry(entry)

      const maxScroll = Math.max(
        0,
        (document.documentElement?.scrollHeight || 0) - window.innerHeight,
      )
      const layoutReady = !entry.anchorHref
        ? maxScroll >= entry.y - 24
        : Boolean(findScrollAnchorElement(entry.anchorHref))
      const stable = entry.anchorHref ? isAnchorStable() : layoutReady
      const budgetExceeded = Date.now() - startedAt >= RESTORE_BUDGET_MS

      if (!stable && !budgetExceeded) return false

      consumeRouteScrollEntry(nextKey)
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
      applyRouteScrollEntry(entry)
      return true
    }

    if (tryRestore()) return undefined

    restoreTimerRef.current = window.setInterval(() => {
      if (tryRestore()) {
        window.clearInterval(restoreTimerRef.current)
        restoreTimerRef.current = null
      }
    }, RESTORE_RETRY_MS)

    return () => {
      cancelled = true
      if (restoreTimerRef.current) {
        window.clearInterval(restoreTimerRef.current)
        restoreTimerRef.current = null
      }
    }
  }, [pathname, searchKey])

  return <span data-testid="route-scroll-memory-host" hidden aria-hidden />
}
