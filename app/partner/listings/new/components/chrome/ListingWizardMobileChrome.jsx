'use client'

import { ListingWizardMobileSlimHeader } from './ListingWizardMobileSlimHeader'
import { ListingWizardMobileStepIndicator } from './ListingWizardMobileStepIndicator'
import { WIZARD_MOBILE_CHROME_POSITION_CLASS } from './listing-wizard-layout'

/**
 * Fixed mobile wizard chrome — slim header + step dots (replaces breadcrumbs + full header below sm).
 */
export function ListingWizardMobileChrome({
  steps,
  currentStep,
  currentStepLabel,
  stepMarkerLabel,
}) {
  return (
    <div className={`sm:hidden ${WIZARD_MOBILE_CHROME_POSITION_CLASS}`}>
      <ListingWizardMobileSlimHeader currentStepLabel={currentStepLabel} />
      <ListingWizardMobileStepIndicator
        steps={steps}
        currentStep={currentStep}
        stepMarkerLabel={stepMarkerLabel}
      />
    </div>
  )
}
