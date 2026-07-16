'use client'

import { useState } from 'react'
import { ListingWizardStepActions } from './ListingWizardStepActions'
import { ListingWizardPreviewSheet } from '../preview/ListingWizardPreviewSheet'
import { WIZARD_MOBILE_ACTION_BAR_POSITION_CLASS } from './listing-wizard-layout'

/**
 * Fixed bottom navigation on mobile — backdrop blur + safe-area + preview sheet trigger.
 */
export function ListingWizardMobileActionBar() {
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <>
      <div
        className={WIZARD_MOBILE_ACTION_BAR_POSITION_CLASS}
        role="navigation"
        aria-label="Listing wizard step navigation"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 safe-area-pb">
          <ListingWizardStepActions onOpenPreview={() => setPreviewOpen(true)} />
        </div>
      </div>

      <ListingWizardPreviewSheet open={previewOpen} onOpenChange={setPreviewOpen} />
    </>
  )
}
