'use client'

import { ListingWizardStepActions } from './ListingWizardStepActions'

/**
 * Step card footer — desktop/tablet only (mobile uses ListingWizardMobileActionBar).
 */
export function ListingWizardStepFooter() {
  return (
    <div className="hidden items-center justify-between gap-3 sm:flex">
      <ListingWizardStepActions />
    </div>
  )
}
