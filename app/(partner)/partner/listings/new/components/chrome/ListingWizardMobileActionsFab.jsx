'use client'

/**
 * Stage 201.55 / 201.60 — wizard save + notifications as PDP-style FABs (under AppHeader).
 * Soft-back lives in AppHeader SSOT; slim secondary bar removed.
 */

import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PartnerNotificationFeed } from '@/components/partner/PartnerNotificationFeed'
import {
  MOBILE_ACTION_FAB_BUTTON_CLASS,
  MOBILE_ACTION_FAB_STACK_CLASS,
  MOBILE_ACTION_FAB_TOP_UNDER_WIZARD_CHROME,
} from '@/lib/layout/mobile-action-fab'
import { useListingWizard } from '../../context/ListingWizardContext'
import { useListingSave } from '../../hooks/useListingSave'
import { cn } from '@/lib/utils'

export function ListingWizardMobileActionsFab() {
  const { t, wizardMode, savingDraft, language } = useListingWizard()
  const { saveDraft, patching } = useListingSave()

  const isEditRoute = wizardMode === 'edit'
  const saveBusy = isEditRoute ? patching : savingDraft
  const saveLabel = isEditRoute ? t('partnerEdit_save') : t('saveDraft')

  return (
    <div
      className={cn(MOBILE_ACTION_FAB_STACK_CLASS, 'sm:hidden')}
      style={{ top: MOBILE_ACTION_FAB_TOP_UNDER_WIZARD_CHROME }}
      data-testid="listing-wizard-actions-fab"
    >
      <PartnerNotificationFeed
        language={language}
        className={cn(MOBILE_ACTION_FAB_BUTTON_CLASS, 'px-0')}
      />
      <Button
        variant="outline"
        size="icon"
        onClick={saveDraft}
        disabled={saveBusy}
        type="button"
        className={MOBILE_ACTION_FAB_BUTTON_CLASS}
        aria-label={saveLabel}
        data-testid="listing-wizard-save"
      >
        {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </Button>
    </div>
  )
}
