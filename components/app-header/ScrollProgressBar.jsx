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
    const completeAndReset = () => {
      setRouteProgress(100)
      window.setTimeout(() => {
        setRouteLoading(false)
        setRouteProgress(0)
      }, 140)
    }
    completeAndReset()
  }, [pathname, searchParams])

  useEffect(() => {
    if (!routeLoading) return undefined
    const id = window.setInterval(() => {
      setRouteProgress((prev) => {
        if (prev >= 92) return prev
        return prev + Math.max(1, Math.round((100 - prev) * 0.12))
      })
    }, 120)
    return () => window.clearInterval(id)
  }, [routeLoading])

  useEffect(() => {
    const markRouteLoading = () => {
      setRouteLoading(true)
      setRouteProgress((prev) => (prev > 10 ? prev : 10))
    }

    const onClickCapture = (event) => {
      const target = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (!target) return
      const href = target.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return
      if (target.getAttribute('target') === '_blank') return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      markRouteLoading()
    }

    const onPopState = () => markRouteLoading()

    document.addEventListener('click', onClickCapture, true)
    window.addEventListener('popstate', onPopState)

    return () => {
      document.removeEventListener('click', onClickCapture, true)
      window.removeEventListener('popstate', onPopState)
    }
  }, [])

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
      className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden"
    >
      <div
        className={
          'h-full origin-left bg-gradient-to-r from-[#006666] via-[#14a8a8] to-[#5dd8d5] transition-[width] duration-150 ease-out ' +
          (activeComplete
            ? 'shadow-[0_0_14px_rgba(0,168,168,0.9)] animate-scroll-glow-pulse'
            : 'shadow-[0_0_6px_rgba(0,168,168,0.45)]') +
          (routeLoading ? ' animate-pulse' : '')
        }
        style={{ width: `${activeProgress}%` }}
      />
    </div>
  )
}

export default ScrollProgressBar
