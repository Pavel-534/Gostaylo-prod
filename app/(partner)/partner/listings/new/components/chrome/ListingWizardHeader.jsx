'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PartnerListingStatusBadge,
  partnerWizardListingStatusTone,
} from '@/components/partner/PartnerListingStatusBadge'
import { useListingWizard } from '../../context/ListingWizardContext'
import { useListingSave } from '../../hooks/useListingSave'

/**
 * Wizard top row: exit, title, status badge, save draft, publish (edit+draft).
 */
export function ListingWizardHeader({ headerTitle }) {
  const router = useRouter()
  const {
    t,
    wizardMode,
    serverListing,
    canFullPublish,
    canSoftPublish,
    loading,
    savingDraft,
  } = useListingWizard()
  const { saveDraft, publishListing, softPublishListing, patching, publishing } = useListingSave()

  const isDraft = Boolean(serverListing?.metadata?.is_draft)
  const isEditRoute = wizardMode === 'edit'
  const saveBusy = isEditRoute ? patching : savingDraft
  const lastStepBusy = isEditRoute ? loading || patching || publishing : loading

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <Button
        variant="ghost"
        onClick={() => router.push('/partner/listings')}
        className="min-h-[44px] min-w-[44px] gap-1.5 px-2 text-slate-600 hover:text-slate-900"
        type="button"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="hidden sm:inline">{t('exit')}</span>
      </Button>
      <div className="flex min-w-0 flex-1 items-center justify-center px-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
          {headerTitle}
        </h1>
      </div>
      <div className="flex shrink-0 items-center justify-end gap-2">
        {isEditRoute && serverListing ? (
          <PartnerListingStatusBadge
            tone={partnerWizardListingStatusTone({
              isDraft,
              status: serverListing.status,
            })}
            className="hidden sm:inline-flex"
          >
            {isDraft
              ? t('partnerEdit_statusDraft')
              : serverListing.status === 'ACTIVE'
                ? t('partnerEdit_statusActive')
                : serverListing.status === 'PENDING'
                  ? t('partnerEdit_statusPending')
                  : t('partnerEdit_statusInactive')}
          </PartnerListingStatusBadge>
        ) : null}
        <Button
          variant="outline"
          onClick={saveDraft}
          disabled={saveBusy}
          className="min-h-[44px] min-w-[44px] gap-1.5"
          type="button"
        >
          {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="hidden sm:inline">
            {isEditRoute ? t('partnerEdit_save') : t('saveDraft')}
          </span>
        </Button>
        {isEditRoute && isDraft && canSoftPublish ? (
          <Button
            onClick={softPublishListing}
            disabled={lastStepBusy}
            variant="outline"
            className="hidden min-h-[44px] min-w-[44px] gap-1.5 sm:inline-flex"
            type="button"
            data-testid="wizard-header-soft-publish-btn"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('listingQuality_softPublish')}
          </Button>
        ) : null}
        {isEditRoute && isDraft ? (
          <Button
            onClick={publishListing}
            disabled={!canFullPublish || lastStepBusy}
            variant="brand"
            className="hidden min-h-[44px] min-w-[44px] gap-1.5 sm:inline-flex"
            type="button"
          >
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('partnerEdit_publish')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
