'use client'

import { Loader2, Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PartnerListingStatusBadge,
  partnerWizardListingStatusTone,
} from '@/components/partner/PartnerListingStatusBadge'
import { useListingWizard } from '../../context/ListingWizardContext'
import { useListingSave } from '../../hooks/useListingSave'

/**
 * Wizard top row: title + step line, status badge, save draft, publish (edit+draft).
 * Exit → AppHeader soft-back (Stage 201.58 — no duplicate exit control).
 */
export function ListingWizardHeader({ headerTitle, stepSubtitle = null }) {
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
  const publishBusy = Boolean(publishing || loading)
  const anyBusy = saveBusy || publishBusy

  return (
    <div className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
          {headerTitle}
        </h1>
        {stepSubtitle ? (
          <p className="mt-0.5 truncate text-xs font-medium tracking-wide text-slate-500 sm:text-sm">
            {stepSubtitle}
          </p>
        ) : null}
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
            disabled={anyBusy}
            variant="outline"
            className="hidden min-h-[44px] min-w-[44px] gap-1.5 sm:inline-flex"
            type="button"
            data-testid="wizard-header-soft-publish-btn"
          >
            {publishBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('listingQuality_softPublish')}
          </Button>
        ) : null}
        {isEditRoute && isDraft ? (
          <Button
            onClick={publishListing}
            disabled={!canFullPublish || anyBusy}
            variant="brand"
            className="hidden min-h-[44px] min-w-[44px] gap-1.5 sm:inline-flex"
            type="button"
          >
            {publishBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {t('partnerEdit_publish')}
          </Button>
        ) : null}
      </div>
    </div>
  )
}
