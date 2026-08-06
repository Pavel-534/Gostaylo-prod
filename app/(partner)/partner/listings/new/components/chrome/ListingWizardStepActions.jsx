'use client'

import { ArrowLeft, ArrowRight, CheckCircle2, Eye, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useListingWizard } from '../../context/ListingWizardContext'
import { useListingSave } from '../../hooks/useListingSave'
import { LISTING_WIZARD_STEP_COUNT } from '../../wizard-constants'
import { WizardStepBlockersHint } from './WizardStepBlockersHint'
import { scrollWizardFieldIntoView } from '../../lib/wizard-field-errors'

/**
 * SSOT step navigation buttons — shared by card footer (desktop) and mobile action bar.
 * Mobile: icon-only Back/Preview + full primary label (no mid-word truncate). Blockers live
 * in the step card on mobile (`ListingWizardMobileBlockers`) so the fixed bar height stays stable.
 */
export function ListingWizardStepActions({ onOpenPreview = null, showBlockersHint = true }) {
  const {
    t,
    tr,
    isEditMode,
    serverListing,
    currentStep,
    canProceed,
    canFullPublish,
    canSoftPublish,
    stepBlockers,
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
  const showStepHints =
    showBlockersHint && !isLastStep && !canProceed && (stepBlockers?.length ?? 0) > 0

  const lastStepLabel = (() => {
    if (isEditMode) {
      return isDraft ? t('partnerEdit_publish') : t('updateListing')
    }
    return t('publishListing')
  })()

  const handleNextClick = () => {
    if (canProceed) {
      goNext()
      return
    }
    const first = stepBlockers?.[0]
    const msg =
      typeof tr === 'function' && first
        ? tr(first.i18nKey, first.params || {})
        : t('wizardBlocker_titleHint', 'Чтобы продолжить:')
    toast.error(msg)
    scrollWizardFieldIntoView(first?.field)
  }

  const backButton = (
    <Button
      variant="outline"
      onClick={goBack}
      disabled={currentStep === 1}
      className={cn(
        'min-h-[44px] min-w-[44px] gap-2 rounded-xl',
        isMobileLayout ? 'w-11 shrink-0 px-0' : undefined,
      )}
      type="button"
      aria-label={t('back')}
      title={t('back')}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" />
      {isMobileLayout ? null : <span>{t('back')}</span>}
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
          isMobileLayout && 'min-w-0 flex-1 px-2 text-xs',
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
        onClick={handleNextClick}
        variant="brand"
        className={cn(
          'min-h-[44px] min-w-[44px] gap-2 rounded-xl',
          isMobileLayout && 'min-w-0 flex-1',
          !canProceed && 'opacity-90',
        )}
        type="button"
        aria-disabled={!canProceed}
        data-testid="wizard-next-btn"
      >
        <span>{t('next')}</span>
        <ArrowRight className="h-4 w-4 shrink-0" />
      </Button>
    ) : (
      <Button
        onClick={publishListing}
        disabled={!canFullPublish || lastStepBusy}
        variant="brand"
        className={cn(
          'min-h-[44px] min-w-[44px] gap-2 rounded-xl',
          isMobileLayout && 'min-w-0 flex-1 px-2 text-xs sm:text-sm',
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

  const hints = showStepHints ? (
    <WizardStepBlockersHint blockers={stepBlockers} t={t} tr={tr} className="w-full min-w-0" />
  ) : null

  if (!onOpenPreview) {
    return (
      <div className="flex w-full min-w-0 flex-col gap-2">
        {hints}
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          {backButton}
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
            {softPublishButton}
            {primaryButton}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full min-w-0 items-center gap-2">
      {backButton}
      <Button
        variant="outline"
        onClick={onOpenPreview}
        className="h-11 w-11 shrink-0 rounded-xl px-0"
        type="button"
        aria-label={t('wizardViewPreview')}
        title={t('wizardViewPreview')}
        data-testid="wizard-mobile-preview-btn"
      >
        <Eye className="h-4 w-4 shrink-0" />
      </Button>
      {softPublishButton}
      {primaryButton}
    </div>
  )
}
