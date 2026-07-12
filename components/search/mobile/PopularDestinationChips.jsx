'use client'

/**
 * Stage 178.9 — mobile search sheet «Куда» quick picks.
 * Recent searches (localStorage) + API-ranked popular destinations (Airbnb-style rows).
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Clock, MapPin } from 'lucide-react'
import { fetchPopularDestinations } from '@/lib/api/popular-destinations-client'
import { getUIText } from '@/lib/translations'
import {
  readRecentSearchLocations,
  subscribeRecentSearchLocations,
} from '@/lib/search/recent-search-locations'
import { cn } from '@/lib/utils'

const ALL_OPTION = {
  value: 'all',
  labels: { ru: 'Везде', en: 'Anywhere', zh: '所有地方', th: 'ทุกที่' },
}

function ChipRow({ children, className }) {
  return (
    <div
      className={cn(
        '-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 scrollbar-none',
        className,
      )}
    >
      {children}
    </div>
  )
}

function DestinationChip({ active, label, value, onSelect, testId }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(value)}
      data-testid={testId}
      className={cn(
        'shrink-0 min-h-11 max-w-[220px] truncate rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95',
        active
          ? 'border-brand bg-brand/10 text-brand-hover'
          : 'border-slate-200 bg-white text-slate-700 hover:border-brand/30',
      )}
    >
      {label}
    </button>
  )
}

function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 text-brand" aria-hidden />
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{label}</p>
    </div>
  )
}

function PopularSkeleton() {
  return (
    <ChipRow aria-hidden>
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-11 w-24 shrink-0 rounded-full bg-slate-100 gsl-shimmer"
        />
      ))}
    </ChipRow>
  )
}

export function PopularDestinationChips({
  language = 'ru',
  where = 'all',
  onSelect,
  className,
}) {
  const [recent, setRecent] = useState([])
  const [popular, setPopular] = useState([])
  const [popularLoading, setPopularLoading] = useState(true)

  const refreshRecent = useCallback(() => {
    setRecent(readRecentSearchLocations())
  }, [])

  useEffect(() => {
    refreshRecent()
    return subscribeRecentSearchLocations(refreshRecent)
  }, [refreshRecent])

  useEffect(() => {
    let cancelled = false
    setPopularLoading(true)
    fetchPopularDestinations({ lang: language, limit: 8 })
      .then((res) => {
        if (cancelled) return
        setPopular(res.items || [])
      })
      .finally(() => {
        if (!cancelled) setPopularLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [language])

  const recentValues = useMemo(() => new Set(recent.map((item) => item.value)), [recent])

  const popularVisible = useMemo(
    () => popular.filter((item) => !recentValues.has(item.value)),
    [popular, recentValues],
  )

  const anywhereLabel = ALL_OPTION.labels[language] || ALL_OPTION.labels.en
  const anywhereActive = where === ALL_OPTION.value || !where

  return (
    <div className={cn('space-y-4', className)} data-testid="popular-destination-chips">
      {recent.length > 0 ? (
        <section className="space-y-2" data-testid="recent-search-locations">
          <SectionHeader icon={Clock} label={getUIText('recentSearches', language)} />
          <ChipRow>
            {recent.map((item) => (
              <DestinationChip
                key={`recent-${item.value}`}
                value={item.value}
                label={item.label}
                active={where === item.value}
                onSelect={onSelect}
                testId={`recent-search-location-${item.value}`}
              />
            ))}
          </ChipRow>
        </section>
      ) : null}

      <section className="space-y-2" data-testid="popular-destinations-dynamic">
        <SectionHeader icon={MapPin} label={getUIText('popularDestinations', language)} />
        {popularLoading ? (
          <PopularSkeleton />
        ) : (
          <ChipRow>
            <DestinationChip
              value={ALL_OPTION.value}
              label={anywhereLabel}
              active={anywhereActive}
              onSelect={onSelect}
              testId="mobile-search-location-all"
            />
            {popularVisible.map((item) => (
              <DestinationChip
                key={`popular-${item.value}`}
                value={item.value}
                label={item.label}
                active={where === item.value}
                onSelect={onSelect}
                testId={`mobile-search-location-${item.value}`}
              />
            ))}
          </ChipRow>
        )}
      </section>
    </div>
  )
}
