'use client'

/**
 * Stage 178.3 — mobile catalog search wizard (one screen at a time).
 * Steps: what → where → when → who; draft → Apply commits to parent + URL.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarIcon, ChevronLeft, Layers, MapPin, Users } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { TimeSelect } from '@/components/ui/time-select'
import { getUIText, getCategoryName } from '@/lib/translations'
import { WhereCombobox } from '@/components/search/WhereCombobox'
import { SearchCalendar } from '@/components/search-calendar'
import { GuestsPopover } from '@/components/search/GuestsPopover'
import { chipIconForCategory } from '@/components/search/category-chip-icon'
import { buildWhereOptions } from '@/lib/locations/where-options'
import { getStaticLocationsSeed } from '@/lib/locations/locations-seed'
import { fetchLocationSuggest } from '@/lib/api/catalog-public-client'
import { orderedCategoriesForSearchUi } from '@/lib/config/category-hierarchy'
import { isCatalogTransportIntervalMode } from '@/lib/search/catalog-transport-interval'
import { useMobileSearchWizardDraft } from '@/lib/hooks/use-mobile-search-wizard-draft'
import {
  getNextWizardStep,
  getPrevWizardStep,
  getWizardStepTitleKey,
  isLastWizardStep,
} from '@/lib/search/mobile-search-wizard-steps'
import { cn } from '@/lib/utils'

const STEP_ICONS = {
  what: Layers,
  where: MapPin,
  when: CalendarIcon,
  who: Users,
}

export function MobileSearchWizard({
  open,
  onOpenChange,
  language = 'ru',
  committedFilters,
  onApply,
  resultCount = 0,
  categoriesForHierarchy = [],
  wizardProfileBySlug = {},
}) {
  const [step, setStep] = useState('what')

  const { draftFilters, patchDraft, discardDraft } = useMobileSearchWizardDraft({
    committed: committedFilters,
    open,
  })

  useEffect(() => {
    if (open) setStep('what')
  }, [open])

  const locations = useMemo(() => getStaticLocationsSeed(), [])
  const whereOptions = useMemo(
    () => buildWhereOptions(locations, language),
    [locations, language],
  )

  const orderedCategoryRows = useMemo(
    () => orderedCategoriesForSearchUi(categoriesForHierarchy),
    [categoriesForHierarchy],
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

  const applyLabel = useMemo(() => {
    const base = getUIText('mobileSearchWizard_showResults', language)
    if (resultCount > 0) {
      return base.replace(/\{\{n\}\}/g, String(resultCount))
    }
    return base.replace(/\s*\(\{\{n\}\}\)/, '').replace(/\{\{n\}\}/g, '')
  }, [language, resultCount])

  const nextLabel = getUIText('mobileSearchWizard_next', language)
  const backLabel = getUIText('mobileSearchWizard_back', language)
  const titleKey = getWizardStepTitleKey(step)
  const StepIcon = STEP_ICONS[step] || Layers
  const isLast = isLastWizardStep(step)
  const prevStep = getPrevWizardStep(step)

  const handleBack = useCallback(() => {
    if (prevStep) setStep(prevStep)
  }, [prevStep])

  const handlePrimary = useCallback(() => {
    if (isLast) {
      handleApply()
      return
    }
    const next = getNextWizardStep(step)
    if (next) setStep(next)
  }, [handleApply, isLast, step])

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground>
      <DrawerContent
        className={cn(
          'mt-0 flex max-h-[92dvh] flex-col rounded-t-[28px] border-slate-200 p-0 md:hidden',
        )}
        data-testid="mobile-search-wizard"
        data-wizard-step={step}
      >
        <DrawerHeader className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-2 text-left">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-200 md:hidden" aria-hidden />
          <div className="flex items-center gap-2">
            {prevStep ? (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100"
                aria-label={backLabel}
                data-testid="mobile-search-wizard-back"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden />
              </button>
            ) : (
              <span className="w-11 shrink-0" aria-hidden />
            )}
            <DrawerTitle className="flex min-w-0 flex-1 items-center gap-2 text-base font-semibold text-slate-900">
              <StepIcon className="h-5 w-5 shrink-0 text-brand" aria-hidden />
              <span className="truncate">{getUIText(titleKey, language)}</span>
            </DrawerTitle>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          {step === 'what' ? (
            <div className="space-y-2" data-testid="mobile-search-wizard-step-what">
              <button
                type="button"
                onClick={() => patchDraft({ selectedCategory: 'all' })}
                className={cn(
                  'flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-colors',
                  draftFilters.selectedCategory === 'all'
                    ? 'border-brand/30 bg-brand/10 text-brand'
                    : 'border-slate-200 hover:bg-slate-50',
                )}
              >
                <Layers className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                {getUIText('allLabel', language)}
              </button>
              {orderedCategoryRows.map(({ cat, depth }) => {
                const slug = cat.slug
                const active = draftFilters.selectedCategory === slug
                const Icon = chipIconForCategory(cat)
                const label = getCategoryName(slug, language) || cat.name
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => patchDraft({ selectedCategory: slug })}
                    className={cn(
                      'flex min-h-11 w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm font-medium transition-colors',
                      active
                        ? 'border-brand/30 bg-brand/10 text-brand'
                        : 'border-slate-200 hover:bg-slate-50',
                      depth ? 'ml-4' : '',
                    )}
                  >
                    {Icon ? (
                      <Icon className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    ) : (
                      <Layers className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                    )}
                    <span className="truncate">
                      {depth ? '· ' : ''}
                      {label}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}

          {step === 'where' ? (
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
          ) : null}

          {step === 'when' ? (
            <div className="space-y-4" data-testid="mobile-search-wizard-step-when">
              <SearchCalendar
                presentation="wizardStep"
                value={draftFilters.dateRange}
                onChange={(dateRange) => patchDraft({ dateRange })}
                locale={language === 'ru' ? 'ru' : 'en'}
              />
              {transportIntervalMode && draftFilters.dateRange?.from && draftFilters.dateRange?.to ? (
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
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
            </div>
          ) : null}

          {step === 'who' ? (
            <GuestsPopover
              presentation="wizardStep"
              language={language}
              guests={draftFilters.guests}
              setGuests={(g) => patchDraft({ guests: g })}
              guestsBreakdown={draftFilters.guestsBreakdown}
              setGuestsBreakdown={(b) => patchDraft({ guestsBreakdown: b })}
            />
          ) : null}
        </div>

        <div
          className={cn(
            'shrink-0 space-y-2 border-t border-slate-200 bg-white px-4 pt-3',
            'pb-[max(1rem,env(safe-area-inset-bottom,0px))]',
          )}
        >
          <Button
            type="button"
            variant="brand"
            className="min-h-12 w-full rounded-2xl text-base font-semibold"
            onClick={handlePrimary}
            data-testid={isLast ? 'mobile-search-wizard-apply' : 'mobile-search-wizard-next'}
          >
            {isLast ? applyLabel : nextLabel}
          </Button>
          {!isLast ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full rounded-2xl text-sm font-medium"
              onClick={handleApply}
              data-testid="mobile-search-wizard-apply-early"
            >
              {applyLabel}
            </Button>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  )
}
