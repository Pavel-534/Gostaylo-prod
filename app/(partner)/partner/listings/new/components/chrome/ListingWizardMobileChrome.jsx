'use client'

import { ListingWizardMobileStepIndicator } from './ListingWizardMobileStepIndicator'
import { ListingWizardMobileActionsFab } from './ListingWizardMobileActionsFab'
import { WIZARD_MOBILE_CHROME_POSITION_CLASS } from './listing-wizard-layout'

/**
 * Fixed mobile wizard chrome — step dots under AppHeader + FAB actions (Stage 201.55).
 * Soft-back / exit → AppHeader SSOT; bell + save → floating FABs like PDP heart.
 */
export function ListingWizardMobileChrome({
  steps,
  currentStep,
  stepMarkerLabel,
}) {
  return (
    <>
      <div className={`sm:hidden ${WIZARD_MOBILE_CHROME_POSITION_CLASS}`}>
        <ListingWizardMobileStepIndicator
          steps={steps}
          currentStep={currentStep}
          stepMarkerLabel={stepMarkerLabel}
        />
      </div>
      <ListingWizardMobileActionsFab />
    </>
  )
}
