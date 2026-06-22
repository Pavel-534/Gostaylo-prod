'use client'

import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useListingWizard } from '../../context/ListingWizardContext'
import { useListingSave } from '../../hooks/useListingSave'
import { LISTING_WIZARD_STEP_COUNT } from '../../wizard-constants'

/**
 * SSOT step navigation buttons — shared by card footer (desktop) and mobile action bar.
 */
export function ListingWizardStepActions({ onOpenPreview = null }) {
  const {
    t,
    isEditMode,
    serverListing,
    currentStep,
    canProceed,
    goNext,
    goBack,
    loading,
    wizardMode,
  } = useListingWizard()
  const { publishListing, patching, publishing } = useListingSave()

  const isDraft = Boolean(serverListing?.metadata?.is_draft)
  const isEditRoute = wizardMode === 'edit'
  const lastStepBusy = isEditRoute ? loading || patching || publishing : loading
  const isMobileLayout = Boolean(onOpenPreview)

  const lastStepLabel = (() => {
    if (isEditMode) {
      return isDraft ? t('partnerEdit_publish') : t('updateListing')
    }
    return t('publishListing')
  })()

  const backButton = (
    <Button
      variant="outline"
      onClick={goBack}
      disabled={currentStep === 1}
      className={cn('gap-2 rounded-xl', isMobileLayout && 'min-w-0 flex-1')}
      type="button"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      <span className={isMobileLayout ? 'truncate' : undefined}>{t('back')}</span>
    </Button>
  )

  const primaryButton =
    currentStep < LISTING_WIZARD_STEP_COUNT ? (
      <Button
        onClick={goNext}
        disabled={!canProceed}
        variant="brand"
        className={cn('gap-2 rounded-xl', isMobileLayout && 'min-w-0 flex-1')}
        type="button"
      >
        <span className={isMobileLayout ? 'truncate' : undefined}>{t('next')}</span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Button>
    ) : (
      <Button
        onClick={publishListing}
        disabled={!canProceed || lastStepBusy}
        variant="brand"
        className={cn('gap-2 rounded-xl', isMobileLayout && 'min-w-0 flex-1')}
        type="button"
      >
        {lastStepBusy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <CheckCircle2 className="h-4 w-4 shrink-0" />
        )}
        <span className={isMobileLayout ? 'truncate' : undefined}>{lastStepLabel}</span>
      </Button>
    )

  if (!onOpenPreview) {
    return (
      <div className="flex w-full items-center justify-between gap-3">
        {backButton}
        {primaryButton}
      </div>
    )
  }

  return (
    <div className="flex w-full items-center gap-2">
      {backButton}
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenPreview}
        className="h-10 shrink-0 gap-1.5 rounded-xl px-2.5"
        type="button"
        aria-label={t('wizardViewPreview')}
      >
        <Eye className="h-4 w-4 shrink-0" />
        <span className="max-w-[4.5rem] truncate text-xs font-medium">{t('wizardViewPreview')}</span>
      </Button>
      {primaryButton}
    </div>
  )
}
