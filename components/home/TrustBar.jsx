'use client'

/**
 * TrustBar — узкая полоса «social proof» под HowItWorks.
 * SSOT: статистика из /api/v2/public/stats (кэш 2ч), переводы через getUIText.
 * Stage 201.27 — honest tiles only; listings count is global (worldwide label only).
 * Пока данные грузятся — skeleton placeholders (3 серые плашки).
 */

import { Home, Star, ShieldCheck } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { useEffect, useRef, useState } from 'react'
import { fetchPublicStats } from '@/lib/api/catalog-public-client'
import { resolveTrustBarMetrics } from '@/lib/home/trust-bar-items'

// ---------- Animated counter ----------
function AnimatedCounter({ target, duration = 1400, suffix = '', decimals = 0 }) {
  const [display, setDisplay] = useState('0')
  const rafRef = useRef(null)
  const startRef = useRef(null)

  useEffect(() => {
    const numericTarget = typeof target === 'number' ? target : parseFloat(target) || 0
    if (numericTarget === 0) { setDisplay('0'); return }
    startRef.current = null

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = eased * numericTarget
      const formatted =
        decimals > 0
          ? current.toFixed(decimals)
          : Math.floor(current) >= 1000
            ? Math.floor(current).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
            : String(Math.floor(current))
      setDisplay(formatted)
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
      else
        setDisplay(
          decimals > 0
            ? numericTarget.toFixed(decimals)
            : numericTarget >= 1000
              ? numericTarget.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f')
              : String(numericTarget),
        )
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [target, duration, decimals])

  return <span>{display}{suffix}</span>
}

// ---------- Skeleton bar ----------
function TrustBarSkeleton() {
  return (
    <div className="relative border-y border-brand/20 bg-gradient-to-r from-brand/10 via-white to-brand/10">
      <div className="container mx-auto px-4">
        <div className="flex items-stretch justify-center divide-x divide-brand/15">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 items-center justify-center gap-3 px-6 py-4 sm:gap-4 sm:px-10 sm:py-5">
              <div className="hidden h-10 w-10 animate-pulse rounded-xl bg-brand/15 sm:block" />
              <div className="space-y-2">
                <div className="h-7 w-20 animate-pulse rounded-md bg-brand/15" />
                <div className="h-3.5 w-28 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------- Main TrustBar ----------
/**
 * @param {object} p
 * @param {string} [p.language='ru']
 */
export function TrustBar({ language = 'ru' }) {
  const [visible, setVisible] = useState(false)
  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const ref = useRef(null)

  // Trigger counter when bar enters viewport (early trigger via rootMargin so мобайл успевает)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.05, rootMargin: '0px 0px 200px 0px' },
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  // Fallback: after stats loaded, flip visible to true within 1.5s if observer didn't fire.
  useEffect(() => {
    if (loadingStats) return
    if (visible) return
    const t = setTimeout(() => setVisible(true), 1500)
    return () => clearTimeout(t)
  }, [loadingStats, visible])

  useEffect(() => {
    let cancelled = false
    fetchPublicStats()
      .then(({ ok, data }) => {
        if (!cancelled && ok) setStats(data)
      })
      .catch(() => { /* leave stats null — no vanity fallback */ })
      .finally(() => { if (!cancelled) setLoadingStats(false) })
    return () => { cancelled = true }
  }, [])

  if (loadingStats) return <TrustBarSkeleton />

  const metrics = resolveTrustBarMetrics(stats)
  const ITEMS = [
    metrics.listingsCount != null
      ? {
          icon: Home,
          value: metrics.listingsCount,
          suffix: '+',
          decimals: 0,
          label: getUIText('trustListingsWorldwide', language),
        }
      : null,
    metrics.avgRating != null
      ? {
          icon: Star,
          value: metrics.avgRating,
          suffix: '★',
          decimals: 1,
          label: getUIText('trustRatingLabel', language),
        }
      : null,
    {
      icon: ShieldCheck,
      value: 100,
      suffix: '%',
      decimals: 0,
      label: getUIText('trustSecurityLabel', language),
      sublabel: getUIText('trustEscrowLabel', language),
    },
  ].filter(Boolean)

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Platform trust signals"
      data-testid="trust-bar"
      className="relative border-y border-brand/20 bg-gradient-to-r from-brand/10 via-white to-brand/10"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-stretch justify-center divide-x divide-brand/15">
          {ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className="flex flex-1 items-center justify-center gap-3 px-6 py-4 sm:gap-4 sm:px-10 sm:py-5"
              >
                <div className="hidden shrink-0 items-center justify-center rounded-xl bg-brand/15 p-2 sm:flex">
                  <Icon className="h-4 w-4 text-brand" aria-hidden />
                </div>
                <div className="text-center sm:text-left">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-2xl font-black leading-none tracking-tight text-brand-hover sm:text-3xl">
                      {visible && item.value != null ? (
                        <AnimatedCounter
                          target={item.value}
                          duration={item.decimals > 0 ? 900 : 1400}
                          suffix={item.suffix}
                          decimals={item.decimals}
                        />
                      ) : (
                        <span
                          className="inline-block h-6 w-16 animate-pulse rounded bg-brand/15 align-middle sm:h-7 sm:w-20"
                          aria-hidden
                        />
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
                    {item.label}
                    {item.sublabel && (
                      <span className="ml-1 text-brand opacity-70">· {item.sublabel}</span>
                    )}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
