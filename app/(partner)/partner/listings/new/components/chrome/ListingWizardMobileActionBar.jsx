'use client'

import { useState } from 'react'
import { ListingWizardStepActions } from './ListingWizardStepActions'
import { ListingWizardPreviewSheet } from '../preview/ListingWizardPreviewSheet'
import { WIZARD_MOBILE_ACTION_BAR_POSITION_CLASS } from './listing-wizard-layout'
import { useListingWizard } from '../../context/ListingWizardContext'

/**
 * Fixed bottom navigation on mobile — backdrop blur + safe-area.
 * Partner BottomNav is hidden on wizard routes (Stage 194.0-A), so no dock collision.
 */
export function ListingWizardMobileActionBar() {
  const [previewOpen, setPreviewOpen] = useState(false)
  const { t } = useListingWizard()

  return (
    <>
      <div
        className={WIZARD_MOBILE_ACTION_BAR_POSITION_CLASS}
        role="navigation"
        aria-label={t('wizardMobileNavAria')}
        data-testid="listing-wizard-mobile-action-bar"
      >
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 safe-area-pb">
          <ListingWizardStepActions onOpenPreview={() => setPreviewOpen(true)} />
        </div>
      </div>

      <ListingWizardPreviewSheet open={previewOpen} onOpenChange={setPreviewOpen} />
    </>
  )
}
