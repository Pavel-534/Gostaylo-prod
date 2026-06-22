'use client'

import { cn } from '@/lib/utils'
import { ListingWizardProgressTrack } from './ListingWizardStepNav'
import { WIZARD_COMPACT_STEP_BAR_POSITION_CLASS } from './listing-wizard-layout'

/**
 * Fixed compact step indicator — visible when workspace scroll exceeds threshold.
 */
export function ListingWizardCompactStepBar({ isScrolled, steps, currentStep, compactStepLine }) {
  return (
    <div
      className={cn(
        WIZARD_COMPACT_STEP_BAR_POSITION_CLASS,
        isScrolled ? 'block' : 'hidden',
      )}
      role="status"
      aria-live="polite"
      aria-hidden={!isScrolled}
    >
      <div className="relative h-9 bg-white shadow-sm">
        <div className="mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
          <p className="truncate text-xs font-medium tracking-wide text-slate-600 sm:text-sm">
            {compactStepLine}
          </p>
        </div>
        <ListingWizardProgressTrack steps={steps} currentStep={currentStep} isScrolled />
      </div>
    </div>
  )
}
