'use client'

/**
 * Stage 200.92 — Wizard step 5: calendar sync, manual blocks, seasonal prices (SSOT).
 */

import { memo } from 'react'
import { CalendarDays } from 'lucide-react'
import { StepCalendarSection } from './StepCalendarSection'
import { useListingWizard } from '../context/ListingWizardContext'
import {
  WIZARD_STEP_ROOT_CLASS,
  WIZARD_STEP_SUBTITLE_CLASS,
  WIZARD_STEP_TITLE_CLASS,
  WIZARD_MOBILE_FLAT_INSET_CLASS,
} from './wizard-step-layout'
import { cn } from '@/lib/utils'

function StepCalendarInner() {
  const { t, editId, serverListing, draftListingIdRef } = useListingWizard()
  const listingId = editId || draftListingIdRef?.current || null
  const ready = Boolean(listingId && serverListing)

  return (
    <div className={WIZARD_STEP_ROOT_CLASS} data-testid="wizard-step-calendar">
      <div>
        <h2 className={WIZARD_STEP_TITLE_CLASS}>{t('wizardStep_calendar')}</h2>
        <p className={`mt-1 ${WIZARD_STEP_SUBTITLE_CLASS}`}>{t('wizardStep_calendarHint')}</p>
      </div>

      {ready ? (
        <StepCalendarSection />
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
          <p className="text-sm leading-relaxed text-slate-600">{t('wizardStep_calendarNeedsDraft')}</p>
        </div>
      )}
    </div>
  )
}

export const StepCalendar = memo(StepCalendarInner)
