'use client'

/**
 * ScrollProgressBar — тонкий индикатор прогресса скролла в нижней части хедера.
 * Teal gradient, 2px height, премиальный штрих в духе Airbnb/Medium.
 *
 * Показывается ТОЛЬКО когда есть что скроллить (scrollHeight > innerHeight + 100px),
 * чтобы не висеть на короткой странице.
 */

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0)
  const [enabled, setEnabled] = useState(false)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeProgress, setRouteProgress] = useState(0)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    let ticking = false
    const compute = () => {
      ticking = false
      const doc = document.documentElement
      const scrollTop = window.scrollY || doc.scrollTop
      const scrollHeight = doc.scrollHeight - doc.clientHeight
      if (scrollHeight < 100) {
        setEnabled(false)
        setProgress(0)
        return
      }
      setEnabled(true)
      const p = Math.max(0, Math.min(100, (scrollTop / scrollHeight) * 100))
      setProgress(p)
    }
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(compute)
    }
    compute()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', compute, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', compute)
    }
  }, [])

  useEffect(() => {
    let resetTimeoutId = null
    const completeAndReset = () => {
      if (!routeLoading) return
      setRouteProgress(100)
      if (resetTimeoutId) window.clearTimeout(resetTimeoutId)
      resetTimeoutId = window.setTimeout(() => {
        setRouteLoading(false)
        window.setTimeout(() => setRouteProgress(0), 180)
      }, 320)
    }
    completeAndReset()
    return () => {
      if (resetTimeoutId) window.clearTimeout(resetTimeoutId)
    }
  }, [pathname, searchParams, routeLoading])

  useEffect(() => {
    if (!routeLoading) return undefined
    const id = window.setInterval(() => {
      setRouteProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.max(1, Math.round((100 - prev) * 0.08))
      })
    }, 180)
    return () => window.clearInterval(id)
  }, [routeLoading])

  useEffect(() => {
    let startDelayTimeoutId = null
    const markRouteLoading = () => {
      if (routeLoading) return
      if (startDelayTimeoutId) window.clearTimeout(startDelayTimeoutId)
      startDelayTimeoutId = window.setTimeout(() => {
        setRouteLoading(true)
        setRouteProgress((prev) => (prev > 8 ? prev : 8))
      }, 120)
    }

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
      markRouteLoading()
    }

    const onPopState = () => markRouteLoading()

    document.addEventListener('click', onClickCapture, true)
    window.addEventListener('popstate', onPopState)

    return () => {
      if (startDelayTimeoutId) window.clearTimeout(startDelayTimeoutId)
      document.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('popstate', onPopState)
    }
  }, [routeLoading])

  if (!enabled && !routeLoading) return null

  const isComplete = progress >= 99.5
  const activeProgress = routeLoading ? routeProgress : progress
  const activeComplete = routeLoading ? routeProgress >= 99.5 : isComplete

  return (
    <div
      data-testid="app-header-scroll-progress"
      data-complete={activeComplete ? 'true' : 'false'}
      data-route-loading={routeLoading ? 'true' : 'false'}
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 w-full h-[2px] overflow-hidden"
    >
      <div
        className={
          'h-full origin-left bg-gradient-to-r from-brand via-brand/70 to-cyan-400 transition-[width,opacity] duration-300 ease-out ' +
          (activeComplete
            ? 'shadow-[0_0_14px_rgba(0,102,102,0.45)] animate-scroll-glow-pulse'
            : 'shadow-[0_0_6px_rgba(0,102,102,0.25)]') +
          (routeLoading ? ' opacity-100' : ' opacity-95')
        }
        style={{ width: `${activeProgress}%` }}
      />
    </div>
  )
}

export default ScrollProgressBar
