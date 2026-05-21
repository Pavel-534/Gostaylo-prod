'use client'

/**
 * TrustBar — узкая полоса «social proof» под Hero-секцией.
 * SSOT: статистика из /api/v2/public/stats (кэш 2ч), переводы через getUIText.
 * Пока данные грузятся — показываются skeleton placeholders (3 серые плашки).
 */

import { Home, Star, ShieldCheck } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { resolveWhereTarget } from '@/lib/locations/resolve-where-target'
import { COUNTRY_PRESETS } from '@/lib/geo/country-presets'
import { useEffect, useMemo, useRef, useState } from 'react'
import { fetchPublicStats } from '@/lib/api/catalog-public-client'

/** Resolve human-readable location name (localized) for trust label */
function getLocationDisplayName(locationContext, language) {
  if (!locationContext || locationContext === 'all') return null
  const target = resolveWhereTarget(locationContext)
  if (!target) return null
  if (target.level === 'country') {
    const c = COUNTRY_PRESETS.find((co) => co.code === target.countryCode)
    return c ? (c.labels[language] || c.labels.en) : null
  }
  if (target.level === 'region') {
    const c = COUNTRY_PRESETS.find((co) => co.code === target.countryCode)
    const r = c?.regions.find((rr) => rr.code === target.regionCode)
    return r ? (r.labels[language] || r.labels.en) : null
  }
  if (target.level === 'city') {
    const c = COUNTRY_PRESETS.find((co) => co.code === target.countryCode)
    const r = c?.regions.find((rr) => rr.code === target.regionCode)
    const ci = r?.cities.find((cc) => cc.code === target.cityCode)
    return ci ? (ci.labels[language] || ci.labels.en) : null
  }
  return null
}

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
    <div className="relative border-y border-teal-100/80 bg-gradient-to-r from-teal-50/60 via-white to-teal-50/60">
      <div className="container mx-auto px-4">
        <div className="flex items-stretch justify-center divide-x divide-teal-100">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 items-center justify-center gap-3 px-6 py-4 sm:gap-4 sm:px-10 sm:py-5">
              <div className="hidden h-10 w-10 animate-pulse rounded-xl bg-teal-100/60 sm:block" />
              <div className="space-y-2">
                <div className="h-7 w-20 animate-pulse rounded-md bg-teal-100/70" />
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
 * @param {string} [p.locationContext='all'] — динамический контекст: 'all' | country code | region code | city slug.
 *   Влияет на label "objects in {…}". Если не передано / 'all' — показываем «по всему миру».
 */
export function TrustBar({ language = 'ru', locationContext = 'all' }) {
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
  // Защищает от случаев когда observer не срабатывает (viewport уже revealed, zoom, и т.п.)
  useEffect(() => {
    if (loadingStats) return
    if (visible) return
    const t = setTimeout(() => setVisible(true), 1500)
    return () => clearTimeout(t)
  }, [loadingStats, visible])

  // Fetch live stats from public API
  useEffect(() => {
    let cancelled = false
    fetchPublicStats()
      .then(({ ok, data }) => {
        if (!cancelled && ok) setStats(data)
      })
      .catch(() => { /* use fallback */ })
      .finally(() => { if (!cancelled) setLoadingStats(false) })
    return () => { cancelled = true }
  }, [])

  // Dynamic listings label: «1200+ объектов в {place}» или «… по всему миру»
  const placeName = useMemo(
    () => getLocationDisplayName(locationContext, language),
    [locationContext, language],
  )

  if (loadingStats) return <TrustBarSkeleton />

  const listingsLabel = placeName
    ? `${getUIText('trustListingsIn', language)} ${placeName}`
    : getUIText('trustListingsWorldwide', language)

  const ITEMS = [
    {
      icon: Home,
      value: stats?.listingsCount && stats.listingsCount > 0 ? stats.listingsCount : 1200,
      suffix: '+',
      decimals: 0,
      label: listingsLabel,
    },
    {
      icon: Star,
      value: stats?.avgRating && stats.avgRating > 0 ? stats.avgRating : 4.9,
      suffix: '★',
      decimals: 1,
      label: getUIText('trustRatingLabel', language),
    },
    {
      icon: ShieldCheck,
      value: 100,
      suffix: '%',
      decimals: 0,
      label: getUIText('trustSecurityLabel', language),
      sublabel: getUIText('trustEscrowLabel', language),
    },
  ]

  return (
    <div
      ref={ref}
      role="region"
      aria-label="Platform trust signals"
      data-testid="trust-bar"
      className="relative border-y border-teal-100/80 bg-gradient-to-r from-teal-50/60 via-white to-teal-50/60"
    >
      <div className="container mx-auto px-4">
        <div className="flex items-stretch justify-center divide-x divide-teal-100">
          {ITEMS.map((item, idx) => {
            const Icon = item.icon
            return (
              <div
                key={idx}
                className="flex flex-1 items-center justify-center gap-3 px-6 py-4 sm:gap-4 sm:px-10 sm:py-5"
              >
                <div className="hidden shrink-0 items-center justify-center rounded-xl bg-teal-100/80 p-2 sm:flex">
                  <Icon className="h-4 w-4 text-teal-600" aria-hidden />
                </div>
                <div className="text-center sm:text-left">
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-2xl font-black leading-none tracking-tight text-teal-700 sm:text-3xl">
                      {visible ? (
                        <AnimatedCounter
                          target={item.value}
                          duration={item.decimals > 0 ? 900 : 1400}
                          suffix={item.suffix}
                          decimals={item.decimals}
                        />
                      ) : (
                        // Pre-visible placeholder: keeps height + showcases skeleton bar (no jumpy layout on mobile)
                        <span
                          className="inline-block h-6 w-16 animate-pulse rounded bg-teal-100/70 align-middle sm:h-7 sm:w-20"
                          aria-hidden
                        />
                      )}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
                    {item.label}
                    {item.sublabel && (
                      <span className="ml-1 text-teal-600 opacity-70">· {item.sublabel}</span>
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

