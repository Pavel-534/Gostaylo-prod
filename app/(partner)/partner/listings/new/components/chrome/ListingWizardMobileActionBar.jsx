'use client'

import { useState } from 'react'
import { ListingWizardStepActions } from './ListingWizardStepActions'
import { ListingWizardPreviewSheet } from '../preview/ListingWizardPreviewSheet'
import {
  WIZARD_MOBILE_ACTION_BAR_INNER_CLASS,
  WIZARD_MOBILE_ACTION_BAR_POSITION_CLASS,
} from './listing-wizard-layout'
import { useListingWizard } from '../../context/ListingWizardContext'

/**
 * Fixed bottom navigation on mobile — backdrop blur + safe-area.
 * Partner BottomNav is hidden on wizard routes (Stage 194.0-A), so no dock collision.
 * Stage 200.98 — vertically balanced padding (do not pair py-* with .safe-area-pb).
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
        <div className={WIZARD_MOBILE_ACTION_BAR_INNER_CLASS}>
          <ListingWizardStepActions onOpenPreview={() => setPreviewOpen(true)} showBlockersHint={false} />
        </div>
      </div>

      <ListingWizardPreviewSheet open={previewOpen} onOpenChange={setPreviewOpen} />
    </>
  )
}
