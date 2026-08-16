'use client'

/**
 * Stage 201.55 — wizard save + notifications as PDP-style FABs (under AppHeader).
 * Soft-back lives in AppHeader SSOT; slim secondary bar removed.
 */

import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PartnerNotificationFeed } from '@/components/partner/PartnerNotificationFeed'
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
      className="pointer-events-none fixed right-3 z-[60] flex flex-col items-center gap-2 sm:hidden sm:right-6"
      style={{
        top: 'calc(var(--app-header-height, 64px) + 2.75rem + 0.5rem)',
      }}
      data-testid="listing-wizard-actions-fab"
    >
      <PartnerNotificationFeed
        language={language}
        className={cn(
          'pointer-events-auto h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 rounded-full px-0',
          'border border-slate-200 bg-white/95 text-slate-600 shadow-md backdrop-blur-md',
          'hover:bg-white hover:text-slate-900',
        )}
      />
      <Button
        variant="outline"
        size="icon"
        onClick={saveDraft}
        disabled={saveBusy}
        type="button"
        className={cn(
          'pointer-events-auto h-11 w-11 min-h-[44px] min-w-[44px] rounded-full',
          'border-slate-200 bg-white/95 shadow-md backdrop-blur-md',
          'touch-manipulation active:scale-[0.98]',
        )}
        aria-label={saveLabel}
        data-testid="listing-wizard-save"
      >
        {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </Button>
    </div>
  )
}
