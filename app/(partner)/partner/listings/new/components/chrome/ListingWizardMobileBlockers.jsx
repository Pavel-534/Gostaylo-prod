'use client'

import { LISTING_WIZARD_STEP_COUNT } from '../../wizard-constants'
import { useListingWizard } from '../../context/ListingWizardContext'
import { WizardStepBlockersHint } from './WizardStepBlockersHint'

/**
 * Mobile-only blockers tip inside the step card (not in the fixed action bar).
 * Keeps bottom bar height stable and avoids horizontal squeeze with long RU labels.
 */
export function ListingWizardMobileBlockers() {
  const { t, tr, currentStep, canProceed, stepBlockers } = useListingWizard()
  const isLastStep = currentStep >= LISTING_WIZARD_STEP_COUNT
  if (isLastStep || canProceed || !(stepBlockers?.length > 0)) return null

  return (
    <div className="mt-6 min-w-0 sm:hidden" data-testid="wizard-mobile-blockers">
      <WizardStepBlockersHint blockers={stepBlockers} t={t} tr={tr} className="w-full min-w-0" />
    </div>
  )
}
