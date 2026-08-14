'use client'

/**
 * Stage 201.18 / 201.22 — app-wide scroll memory (root host).
 * Restore uses live window.location only (not stale React search from PDP).
 * While pending, retry until the live key has an entry (catalog query race).
 */

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  applyRouteScrollEntry,
  consumePendingRouteScrollRestore,
  consumeRouteScrollEntry,
  findScrollAnchorElement,
  liveRouteScrollKey,
  markPendingRouteScrollRestore,
  peekPendingRouteScrollRestore,
  peekRouteScrollEntry,
  persistLiveRouteScroll,
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
  const [restoreGen, setRestoreGen] = useState(0)

  const routeKeyRef = useRef(null)
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
      persistLiveRouteScroll(extra)
    }

    const onScroll = () => {
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
    }

    const onPopState = () => {
      pendingPopRestoreRef.current = true
      markPendingRouteScrollRestore()
      setSearchKey(readSearchKey())
      setRestoreGen((n) => n + 1)
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

    const liveKey = liveRouteScrollKey()
    const prevKey = routeKeyRef.current
    if (prevKey && liveKey && prevKey !== liveKey) {
      const y = Math.max(0, Math.round(lastYRef.current || 0))
      if (y > 0) saveRouteScroll(prevKey, y)
    }
    if (liveKey) routeKeyRef.current = liveKey

    if (restoreTimerRef.current) {
      window.clearInterval(restoreTimerRef.current)
      restoreTimerRef.current = null
    }

    const wantsRestore = pendingPopRestoreRef.current || peekPendingRouteScrollRestore()

    if (!wantsRestore) {
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
      return undefined
    }

    let cancelled = false
    const startedAt = Date.now()
    let activeKey = null
    let activeEntry = null

    const isAnchorStable = (entry) => {
      if (!entry?.anchorHref || !Number.isFinite(Number(entry.anchorTop))) return false
      const el = findScrollAnchorElement(entry.anchorHref)
      if (!el) return false
      return Math.abs(el.getBoundingClientRect().top - Number(entry.anchorTop)) <= ANCHOR_TOLERANCE_PX
    }

    const finishMiss = () => {
      pendingPopRestoreRef.current = false
      consumePendingRouteScrollRestore()
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
    }

    const tryRestore = () => {
      if (cancelled) return true

      if (!activeEntry) {
        const key = liveRouteScrollKey()
        const entry = key ? peekRouteScrollEntry(key) : null
        if (!entry || (entry.y <= 0 && !entry.anchorHref)) {
          if (Date.now() - startedAt >= RESTORE_BUDGET_MS) {
            finishMiss()
            return true
          }
          return false
        }
        activeKey = key
        activeEntry = entry
        pendingPopRestoreRef.current = false
        consumePendingRouteScrollRestore()
      }

      applyRouteScrollEntry(activeEntry)

      const maxScroll = Math.max(
        0,
        (document.documentElement?.scrollHeight || 0) - window.innerHeight,
      )
      const layoutReady = !activeEntry.anchorHref
        ? maxScroll >= activeEntry.y - 24
        : Boolean(findScrollAnchorElement(activeEntry.anchorHref))
      const stable = activeEntry.anchorHref ? isAnchorStable(activeEntry) : layoutReady
      const budgetExceeded = Date.now() - startedAt >= RESTORE_BUDGET_MS

      if (!stable && !budgetExceeded) return false

      if (activeKey) consumeRouteScrollEntry(activeKey)
      lastYRef.current = Math.max(0, Math.round(window.scrollY || 0))
      applyRouteScrollEntry(activeEntry)
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
  }, [pathname, searchKey, restoreGen])

  return <span data-testid="route-scroll-memory-host" hidden aria-hidden />
}
