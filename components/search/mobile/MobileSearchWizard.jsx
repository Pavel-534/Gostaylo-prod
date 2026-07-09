'use client'

/**
 * Stage 178.5 — mobile catalog search panel (single screen).
 * All filters inline in one Vaul drawer; draft → Apply on «Найти».
 */

import { useCallback, useMemo } from 'react'
import { CalendarIcon, MapPin, Search, Users, X } from 'lucide-react'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { TimeSelect } from '@/components/ui/time-select'
import { getUIText } from '@/lib/translations'
import { WhereCombobox } from '@/components/search/WhereCombobox'
import { SearchCalendar } from '@/components/search-calendar'
import { GuestsPopover } from '@/components/search/GuestsPopover'
import { buildWhereOptions } from '@/lib/locations/where-options'
import { getStaticLocationsSeed } from '@/lib/locations/locations-seed'
import { fetchLocationSuggest } from '@/lib/api/catalog-public-client'
import { isCatalogTransportIntervalMode } from '@/lib/search/catalog-transport-interval'
import { useMobileSearchWizardDraft } from '@/lib/hooks/use-mobile-search-wizard-draft'
import { cn } from '@/lib/utils'

function MobileSearchSectionLabel({ icon: Icon, children }) {
  return (
    <div className="mb-2 flex items-center gap-1.5">
      {Icon ? <Icon className="h-3 w-3 shrink-0 text-brand" aria-hidden /> : null}
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{children}</p>
    </div>
  )
}

export function MobileSearchWizard({
  open,
  onOpenChange,
  language = 'ru',
  committedFilters,
  onApply,
  resultCount = 0,
  wizardProfileBySlug = {},
}) {
  const { draftFilters, patchDraft, discardDraft } = useMobileSearchWizardDraft({
    committed: committedFilters,
    open,
  })

  const locations = useMemo(() => getStaticLocationsSeed(), [])
  const whereOptions = useMemo(
    () => buildWhereOptions(locations, language),
    [locations, language],
  )

  const transportIntervalMode = useMemo(
    () => isCatalogTransportIntervalMode(draftFilters.selectedCategory, wizardProfileBySlug),
    [draftFilters.selectedCategory, wizardProfileBySlug],
  )

  const fetchWhereSuggestions = useCallback(
    async (q) => {
      const res = await fetchLocationSuggest({ q, lang: language, limit: 12 })
      return res.ok ? res.items : []
    },
    [language],
  )

  const handleOpenChange = useCallback(
    (nextOpen) => {
      if (!nextOpen) discardDraft()
      onOpenChange?.(nextOpen)
    },
    [discardDraft, onOpenChange],
  )

  const handleApply = useCallback(() => {
    onApply?.(draftFilters)
    onOpenChange?.(false)
  }, [draftFilters, onApply, onOpenChange])

  const findLabel = useMemo(() => {
    const base = getUIText('findButton', language)
    if (resultCount > 0) {
      return `${base} (${resultCount})`
    }
    return base
  }, [language, resultCount])

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground>
      <DrawerContent
        className={cn(
          'mt-0 flex max-h-[92dvh] flex-col rounded-t-[28px] border-slate-200 p-0 md:hidden',
        )}
        data-testid="mobile-search-wizard"
      >
        <DrawerHeader className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-2 text-left">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200 md:hidden" aria-hidden />
          <div className="flex items-center justify-between gap-3">
            <DrawerTitle className="text-xl font-semibold tracking-tight text-slate-900">
              {getUIText('mobileNavSearch', language)}
            </DrawerTitle>
            <DrawerClose asChild>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                aria-label={language === 'ru' ? 'Закрыть' : 'Close'}
                data-testid="mobile-search-wizard-close"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          <div className="space-y-6">
            <section data-testid="mobile-search-panel-where">
              <MobileSearchSectionLabel icon={MapPin}>
                {getUIText('whereShort', language)}
              </MobileSearchSectionLabel>
              <WhereCombobox
                presentation="wizardStep"
                options={whereOptions}
                value={draftFilters.where || 'all'}
                onChange={(next) => patchDraft({ where: next })}
                placeholder={getUIText('whereShort', language)}
                fetchSuggestions={fetchWhereSuggestions}
                language={language}
                variant="compact"
              />
            </section>

            <section data-testid="mobile-search-panel-when">
              <MobileSearchSectionLabel icon={CalendarIcon}>
                {getUIText('dates', language)}
              </MobileSearchSectionLabel>
              <SearchCalendar
                presentation="wizardStep"
                value={draftFilters.dateRange}
                onChange={(dateRange) => patchDraft({ dateRange })}
                locale={language === 'ru' ? 'ru' : 'en'}
              />
              {transportIntervalMode && draftFilters.dateRange?.from && draftFilters.dateRange?.to ? (
                <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <TimeSelect
                    value={draftFilters.checkInTime}
                    onChange={(v) => patchDraft({ checkInTime: v })}
                    className="min-h-11"
                  />
                  <TimeSelect
                    value={draftFilters.checkOutTime}
                    onChange={(v) => patchDraft({ checkOutTime: v })}
                    className="min-h-11"
                  />
                </div>
              ) : null}
            </section>

            <section data-testid="mobile-search-panel-who">
              <MobileSearchSectionLabel icon={Users}>
                {getUIText('mobileSearchWhoTitle', language)}
              </MobileSearchSectionLabel>
              <GuestsPopover
                presentation="wizardStep"
                language={language}
                guests={draftFilters.guests}
                setGuests={(g) => patchDraft({ guests: g })}
                guestsBreakdown={draftFilters.guestsBreakdown}
                setGuestsBreakdown={(b) => patchDraft({ guestsBreakdown: b })}
              />
            </section>
          </div>
        </div>

        <div
          className={cn(
            'shrink-0 border-t border-slate-200 bg-white px-4 pt-3',
            'pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
          )}
        >
          <Button
            type="button"
            variant="brand"
            className="min-h-12 w-full gap-2 rounded-2xl text-base font-semibold"
            onClick={handleApply}
            data-testid="mobile-search-wizard-apply"
          >
            <Search className="h-5 w-5 shrink-0" aria-hidden />
            {findLabel}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
