'use client'

/**
 * Popular destination quick chips — SSOT for mobile search sheet «Куда» section.
 * Migrated from legacy MobileSearchBottomSheet (Global Pivot groups).
 */

import { useMemo } from 'react'
import { MapPin } from 'lucide-react'
import { POPULAR_DESTINATION_GROUPS } from '@/lib/locations/popular-destinations'
import { reorderDestinationsByGeo } from '@/lib/locations/reorder-by-geo'
import { useUserGeo } from '@/lib/hooks/useUserGeo'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'

const ALL_OPTION = {
  value: 'all',
  labels: { ru: 'Везде', en: 'Anywhere', zh: '所有地方', th: 'ทุกที่' },
}

export function PopularDestinationChips({
  language = 'ru',
  where = 'all',
  onSelect,
  className,
}) {
  const { country: userCountry } = useUserGeo()
  const orderedGroups = useMemo(
    () => reorderDestinationsByGeo(POPULAR_DESTINATION_GROUPS, userCountry),
    [userCountry],
  )

  return (
    <div className={cn('space-y-3', className)} data-testid="popular-destination-chips">
      <div className="flex items-center gap-1.5">
        <MapPin className="h-3 w-3 text-brand" aria-hidden />
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
          {getUIText('popularDestinations', language)}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onSelect?.(ALL_OPTION.value)}
        data-testid="mobile-search-location-all"
        className={cn(
          'min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95',
          where === ALL_OPTION.value || !where
            ? 'border-brand bg-brand/10 text-brand-hover'
            : 'border-slate-200 bg-white text-slate-600 hover:border-brand/30',
        )}
      >
        {ALL_OPTION.labels[language] || ALL_OPTION.labels.en}
      </button>

      {orderedGroups.map((group) => (
        <div key={group.id}>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
            <span aria-hidden>{group.flag}</span>
            <span>{group.titles[language] || group.titles.en}</span>
          </p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-none">
            {group.items.map((loc) => {
              const active = where === loc.value
              return (
                <button
                  key={loc.value}
                  type="button"
                  onClick={() => onSelect?.(loc.value)}
                  data-testid={`mobile-search-location-${loc.value}`}
                  className={cn(
                    'shrink-0 min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-150 active:scale-95',
                    active
                      ? 'border-brand bg-brand/10 text-brand-hover'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand/30',
                  )}
                >
                  {loc.labels[language] || loc.labels.en}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
