'use client'

/**
 * Stage 200.92 / 200.93 — Wizard step 5: calendar sync, manual blocks, seasonal prices (SSOT).
 * On enter: ensure draft exists + soft-load serverListing (no form wipe).
 */

import { memo, useEffect, useRef, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { StepCalendarSection } from './StepCalendarSection'
import { useListingWizard } from '../context/ListingWizardContext'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_TITLE_CLASS,
  WIZARD_MOBILE_FLAT_INSET_CLASS,
} from './wizard-step-layout'
import { cn } from '@/lib/utils'

function StepCalendarInner() {
  const {
    t,
    editId,
    serverListing,
    draftListingIdRef,
    ensureCalendarListingReady,
    transportWizard,
  } = useListingWizard()
  const listingId = editId || draftListingIdRef?.current || null
  const [resolvedId, setResolvedId] = useState(listingId)
  const ready = Boolean((resolvedId || listingId) && serverListing)
  const [preparing, setPreparing] = useState(!ready)
  const ensureRef = useRef(ensureCalendarListingReady)
  ensureRef.current = ensureCalendarListingReady

  useEffect(() => {
    if (listingId && listingId !== resolvedId) setResolvedId(listingId)
  }, [listingId, resolvedId])

  useEffect(() => {
    if (ready) {
      setPreparing(false)
      return undefined
    }
    let cancelled = false
    setPreparing(true)
    ;(async () => {
      try {
        const id = await ensureRef.current?.()
        if (!cancelled && id) setResolvedId(id)
      } finally {
        if (!cancelled) setPreparing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready])

  const showTools = Boolean((resolvedId || listingId) && serverListing)
  const calendarHint = transportWizard
    ? t('wizardStep_calendarHintVehicle')
    : t('wizardStep_calendarHint')
  const needsDraftCopy = transportWizard
    ? t('wizardStep_calendarNeedsDraftVehicle')
    : t('wizardStep_calendarNeedsDraft')

  return (
    <div className={WIZARD_STEP_ROOT_CLASS} data-testid="wizard-step-calendar">
      <div>
        <h2 className={`mb-1 ${WIZARD_STEP_TITLE_CLASS}`}>{t('wizardStep_calendar')}</h2>
        <p className="text-xs leading-relaxed text-slate-500">{calendarHint}</p>
      </div>

      {showTools ? (
        <StepCalendarSection />
      ) : preparing ? (
        <div
          className={cn(WIZARD_MOBILE_FLAT_INSET_CLASS, 'space-y-3 sm:bg-slate-50')}
          data-testid="wizard-calendar-preparing"
          aria-busy="true"
        >
          <div className="gsl-shimmer h-11 w-11 rounded-2xl" />
          <div className="gsl-shimmer h-4 w-3/4 max-w-sm rounded-md" />
          <p className="text-sm leading-relaxed text-slate-600">{t('wizardStep_calendarPreparing')}</p>
        </div>
      ) : (
        <div
          className={cn(
            WIZARD_MOBILE_FLAT_INSET_CLASS,
            'flex flex-col items-start gap-3 sm:bg-slate-50',
          )}
          data-testid="wizard-calendar-needs-draft"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mint/15 text-brand-mint">
            <CalendarDays className="h-5 w-5" aria-hidden />
          </div>
          <p className="text-sm leading-relaxed text-slate-600">{needsDraftCopy}</p>
        </div>
      )}
    </div>
  )
}

export const StepCalendar = memo(StepCalendarInner)
