'use client'

import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Loader2, Send } from 'lucide-react'
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
    canFullPublish,
    canSoftPublish,
    goNext,
    goBack,
    loading,
    wizardMode,
  } = useListingWizard()
  const { publishListing, softPublishListing, patching, publishing } = useListingSave()

  const isDraft = Boolean(serverListing?.metadata?.is_draft)
  const isEditRoute = wizardMode === 'edit'
  const lastStepBusy = isEditRoute ? loading || patching || publishing : loading
  const isMobileLayout = Boolean(onOpenPreview)
  const isLastStep = currentStep >= LISTING_WIZARD_STEP_COUNT

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
      className={cn(
        'min-h-[44px] min-w-[44px] gap-2 rounded-xl',
        isMobileLayout && 'flex-1 min-w-0',
      )}
      type="button"
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      <span className={isMobileLayout ? 'truncate' : undefined}>{t('back')}</span>
    </Button>
  )

  const softPublishButton =
    isLastStep && canSoftPublish ? (
      <Button
        onClick={softPublishListing}
        disabled={lastStepBusy}
        variant="outline"
        className={cn(
          'min-h-[44px] min-w-[44px] gap-2 rounded-xl',
          isMobileLayout && 'flex-1 min-w-0',
        )}
        type="button"
        data-testid="wizard-soft-publish-btn"
      >
        {lastStepBusy ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
        ) : (
          <Send className="h-4 w-4 shrink-0" />
        )}
        <span className={isMobileLayout ? 'truncate' : undefined}>
          {t('listingQuality_softPublish')}
        </span>
      </Button>
    ) : null

  const primaryButton =
    currentStep < LISTING_WIZARD_STEP_COUNT ? (
      <Button
        onClick={goNext}
        disabled={!canProceed}
        variant="brand"
        className={cn(
          'min-h-[44px] min-w-[44px] gap-2 rounded-xl',
          isMobileLayout && 'flex-1 min-w-0',
        )}
        type="button"
      >
        <span className={isMobileLayout ? 'truncate' : undefined}>{t('next')}</span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Button>
    ) : (
      <Button
        onClick={publishListing}
        disabled={!canFullPublish || lastStepBusy}
        variant="brand"
        className={cn(
          'min-h-[44px] min-w-[44px] gap-2 rounded-xl',
          isMobileLayout && 'flex-1 min-w-0',
        )}
        type="button"
        data-testid="wizard-full-publish-btn"
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
      <div className="flex w-full flex-wrap items-center justify-between gap-3">
        {backButton}
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
          {softPublishButton}
          {primaryButton}
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full items-center gap-2">
      {backButton}
      <Button
        variant="outline"
        onClick={onOpenPreview}
        className="min-h-[44px] min-w-[44px] shrink-0 gap-1.5 rounded-xl px-2.5"
        type="button"
        aria-label={t('wizardViewPreview')}
      >
        <Eye className="h-4 w-4 shrink-0" />
        <span className="max-w-[4.5rem] truncate text-xs font-medium">{t('wizardViewPreview')}</span>
      </Button>
      {softPublishButton}
      {primaryButton}
    </div>
  )
}
