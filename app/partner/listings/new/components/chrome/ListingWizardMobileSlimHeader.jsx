'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PartnerNotificationFeed } from '@/components/partner/PartnerNotificationFeed'
import { useListingWizard } from '../../context/ListingWizardContext'
import { useListingSave } from '../../hooks/useListingSave'

/**
 * Mobile-only slim header: exit, current step label, notifications, save draft.
 */
export function ListingWizardMobileSlimHeader({ currentStepLabel }) {
  const router = useRouter()
  const { t, wizardMode, savingDraft, language } = useListingWizard()
  const { saveDraft, patching } = useListingSave()

  const isEditRoute = wizardMode === 'edit'
  const saveBusy = isEditRoute ? patching : savingDraft
  const saveLabel = isEditRoute ? t('partnerEdit_save') : t('saveDraft')

  return (
    <div className="flex h-11 items-center justify-between gap-1.5 px-2 sm:px-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push('/partner/listings')}
        className="h-9 w-9 shrink-0 px-0 text-slate-600 hover:text-slate-900"
        type="button"
        aria-label={t('exit')}
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-center text-sm font-semibold tracking-tight text-slate-900">
        {currentStepLabel}
      </h1>
      <div className="flex shrink-0 items-center gap-0.5">
        <PartnerNotificationFeed language={language} className="h-9 w-9 shrink-0 px-0" />
        <Button
          variant="outline"
          size="sm"
          onClick={saveDraft}
          disabled={saveBusy}
          className="h-9 w-9 shrink-0 px-0"
          type="button"
          aria-label={saveLabel}
        >
          {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
