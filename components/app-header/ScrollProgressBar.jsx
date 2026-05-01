'use client'

/**
 * ScrollProgressBar — тонкий индикатор прогресса скролла в нижней части хедера.
 * Teal gradient, 2px height, премиальный штрих в духе Airbnb/Medium.
 *
 * Показывается ТОЛЬКО когда есть что скроллить (scrollHeight > innerHeight + 100px),
 * чтобы не висеть на короткой странице.
 */

import { useEffect, useState } from 'react'

export function ScrollProgressBar() {
  const [progress, setProgress] = useState(0)
  const [enabled, setEnabled] = useState(false)

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

  if (!enabled) return null

  const isComplete = progress >= 99.5

  return (
    <div
      data-testid="app-header-scroll-progress"
      data-complete={isComplete ? 'true' : 'false'}
      aria-hidden
      className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] overflow-hidden"
    >
      <div
        className={
          'h-full origin-left bg-gradient-to-r from-[#006666] via-[#14a8a8] to-[#5dd8d5] transition-[width] duration-150 ease-out ' +
          (isComplete
            ? 'shadow-[0_0_14px_rgba(0,168,168,0.9)] animate-scroll-glow-pulse'
            : 'shadow-[0_0_6px_rgba(0,168,168,0.45)]')
        }
        style={{ width: `${progress}%` }}
      />
    </div>
  )
}

export default ScrollProgressBar
