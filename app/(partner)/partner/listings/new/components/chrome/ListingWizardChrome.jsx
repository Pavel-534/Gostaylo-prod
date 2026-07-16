'use client'

import { ListingWizardCompactStepBar } from './ListingWizardCompactStepBar'
import { ListingWizardHeader } from './ListingWizardHeader'
import { ListingWizardMobileChrome } from './ListingWizardMobileChrome'
import { ListingWizardProgressTrack, ListingWizardStepNav } from './ListingWizardStepNav'

/**
 * Listing wizard chrome — mobile fixed slim stack (<sm) + desktop expanded header (sm+).
 */
export function ListingWizardChrome({
  isScrolled,
  steps,
  currentStep,
  compactStepLine,
  headerTitle,
  currentStepLabel,
  stepMarkerLabel,
  onStepSelect,
}) {
  return (
    <>
      <ListingWizardMobileChrome
        steps={steps}
        currentStep={currentStep}
        currentStepLabel={currentStepLabel}
        stepMarkerLabel={stepMarkerLabel}
      />

      <div className="hidden sm:contents">
        <ListingWizardCompactStepBar
          isScrolled={isScrolled}
          steps={steps}
          currentStep={currentStep}
          compactStepLine={compactStepLine}
        />

        <header className="relative border-b border-slate-200/80 bg-white pb-0.5">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <ListingWizardHeader headerTitle={headerTitle} />

            <ListingWizardStepNav
              steps={steps}
              currentStep={currentStep}
              onStepSelect={onStepSelect}
            />
          </div>
          {!isScrolled ? (
            <ListingWizardProgressTrack steps={steps} currentStep={currentStep} />
          ) : null}
        </header>
      </div>
    </>
  )
}
