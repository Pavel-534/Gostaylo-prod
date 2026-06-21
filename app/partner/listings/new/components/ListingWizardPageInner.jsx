'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Loader2,
  Send,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ListingCard } from '@/components/listing-card'
import { useListingWizard } from '../context/ListingWizardContext'
import { useListingSave } from '../hooks/useListingSave'
import { StepGeneralInfo } from './StepGeneralInfo'
import { StepLocation } from './StepLocation'
import { StepPhotos } from './StepPhotos'
import { StepPricing } from './StepPricing'
import { StepPreview } from './StepPreview'
import { StepCalendarSection } from './StepCalendarSection'
import { ListingWizardStepNav, ListingWizardProgressTrack } from './ListingWizardStepNav'
import { PartnerReferralWizardBanner } from '@/components/partner/PartnerReferralWizardBanner'
import {
  PartnerListingStatusBadge,
  partnerWizardListingStatusTone,
} from '@/components/partner/PartnerListingStatusBadge'
import { LISTING_WIZARD_STEP_COUNT } from '../wizard-constants'
import { useWorkspaceScrollTrigger } from '@/lib/hooks/use-workspace-scroll-trigger'
import {
  LISTING_WIZARD_STICKY_TOP_EXPANDED,
} from '@/lib/layout/workspace-shell'

/** h-9 (36px) + 2px progress track — compact step indicator (Stage 171.10). */
const WIZARD_COMPACT_STEP_INDICATOR_HEIGHT = '2.375rem'

/**
 * Flush under partner breadcrumb toolbar (outside scrollport).
 * Mobile toolbar ≈2.5rem (py-2); desktop row ≈3rem (py-3) — see WORKSPACE_*_TOOLBAR in layout.
 */
const WIZARD_COMPACT_STEP_BAR_POSITION_CLASS =
  'fixed left-0 right-0 top-[calc(var(--app-header-height,64px)+2.5rem)] z-50 w-full lg:left-64 lg:top-[calc(var(--app-header-height,64px)+3rem)]'

export function ListingWizardPageInner() {
  const router = useRouter()
  const w = useListingWizard()
  const { saveDraft, publishListing, patching, publishing } = useListingSave()
  const {
    t,
    isEditMode,
    wizardMode,
    editId,
    serverListing,
    currentStep,
    setCurrentStep,
    loading,
    savingDraft,
    formData,
    language,
    listingCategorySlug,
    canProceed,
    goNext,
    goBack,
    pricingPreview,
    isDirty,
    draftRestored,
  } = w

  useEffect(() => {
    if (!isDirty) return undefined
    const onBeforeUnload = (e) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  const restoreToastShownRef = useRef(false)
  useEffect(() => {
    if (draftRestored && !restoreToastShownRef.current) {
      restoreToastShownRef.current = true
      toast.success(t('wizardDraftRestored'))
    }
  }, [draftRestored, t])

  /** Deep-link: /partner/listings/[id]?highlight=calendar */
  useEffect(() => {
    if (typeof window === 'undefined' || wizardMode !== 'edit' || !serverListing) return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('highlight') !== 'calendar') return
    const timer = setTimeout(() => {
      document.getElementById('partner-calendar-sync')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      toast.success(t('partnerCal_toastScroll'))
      window.history.replaceState({}, '', window.location.pathname)
    }, 600)
    return () => clearTimeout(timer)
  }, [serverListing, wizardMode, t])

  const isDraft = Boolean(serverListing?.metadata?.is_draft)
  const isEditRoute = wizardMode === 'edit'
  const headerTitle = isEditRoute
    ? isDraft
      ? t('partnerEdit_fillDraft')
      : t('partnerEdit_editTitle')
    : isEditMode
      ? t('editListing')
      : t('createNewListing')
  const saveBusy = isEditRoute ? patching : savingDraft
  const lastStepBusy = isEditRoute ? loading || patching || publishing : loading

  const STEPS = useMemo(
    () => [
      { id: 1, label: t('basics') },
      { id: 2, label: t('location') },
      { id: 3, label: t('gallery') },
      { id: 4, label: t('pricing') },
      { id: 5, label: t('livePreview') },
    ],
    [t],
  )

  const stepContent = useMemo(() => {
    switch (currentStep) {
      case 1:
        return <StepGeneralInfo />
      case 2:
        return <StepLocation />
      case 3:
        return <StepPhotos />
      case 4:
        return <StepPricing />
      case 5:
        return <StepPreview />
      default:
        return null
    }
  }, [currentStep])

  const lastStepLabel = (() => {
    if (isEditMode) {
      return isDraft ? t('partnerEdit_publish') : t('updateListing')
    }
    return t('publishListing')
  })()

  const { isScrolled, anchorRef } = useWorkspaceScrollTrigger({ threshold: 20 })

  const stepMarker = t('wizardStepMarker')
    .replace('{current}', String(currentStep))
    .replace('{total}', String(LISTING_WIZARD_STEP_COUNT))

  const currentStepLabel = STEPS.find((s) => s.id === currentStep)?.label ?? ''
  const compactStepLine = `${stepMarker}: ${currentStepLabel}`

  const previewStickyTop = isScrolled
    ? WIZARD_COMPACT_STEP_INDICATOR_HEIGHT
    : LISTING_WIZARD_STICKY_TOP_EXPANDED

  return (
    <div ref={anchorRef} className="w-full bg-slate-50">
      <div
        className={cn(
          WIZARD_COMPACT_STEP_BAR_POSITION_CLASS,
          isScrolled ? 'block' : 'hidden',
        )}
        role="status"
        aria-live="polite"
        aria-hidden={!isScrolled}
      >
        <div className="relative h-9 bg-white shadow-sm">
          <div className="mx-auto flex h-full max-w-7xl items-center px-4 sm:px-6 lg:px-8">
            <p className="truncate text-xs font-medium tracking-wide text-slate-600 sm:text-sm">
              {compactStepLine}
            </p>
          </div>
          <ListingWizardProgressTrack steps={STEPS} currentStep={currentStep} isScrolled />
        </div>
      </div>

      <header className="relative border-b border-slate-200/80 bg-white pb-0.5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/partner/listings')}
              className="gap-1.5 px-2 text-slate-600 hover:text-slate-900"
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
                size="sm"
                onClick={saveDraft}
                disabled={saveBusy}
                className="gap-1.5"
                type="button"
              >
                {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                <span className="hidden sm:inline">
                  {isEditRoute ? t('partnerEdit_save') : t('saveDraft')}
                </span>
              </Button>
              {isEditRoute && isDraft ? (
                <Button
                  onClick={publishListing}
                  disabled={!canProceed || lastStepBusy}
                  variant="brand"
                  size="sm"
                  className="hidden gap-1.5 sm:inline-flex"
                  type="button"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t('partnerEdit_publish')}
                </Button>
              ) : null}
            </div>
          </div>

          <ListingWizardStepNav
            steps={STEPS}
            currentStep={currentStep}
            onStepSelect={setCurrentStep}
          />
        </div>
        {!isScrolled ? (
          <ListingWizardProgressTrack steps={STEPS} currentStep={currentStep} />
        ) : null}
      </header>

      <div className="relative z-0 mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        {!isEditRoute ? <PartnerReferralWizardBanner className="mb-6" /> : null}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="rounded-2xl border-slate-200/90 bg-white shadow-sm">
              <CardContent className="p-5 sm:p-8">
                <div className="relative z-0">{stepContent}</div>
                <Separator className="my-8" />
                <div className="flex items-center justify-between gap-3">
                  <Button
                    variant="outline"
                    onClick={goBack}
                    disabled={currentStep === 1}
                    className="gap-2 rounded-xl"
                    type="button"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('back')}
                  </Button>
                  {currentStep < LISTING_WIZARD_STEP_COUNT ? (
                    <Button
                      onClick={goNext}
                      disabled={!canProceed}
                      variant="brand"
                      className="gap-2 rounded-xl"
                      type="button"
                    >
                      {t('next')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={publishListing}
                      disabled={!canProceed || lastStepBusy}
                      variant="brand"
                      className="gap-2 rounded-xl"
                      type="button"
                    >
                      {lastStepBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {lastStepLabel}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {isEditRoute && editId && serverListing ? <StepCalendarSection /> : null}
          </div>

          <div className="lg:col-span-1">
            <div
              className="sticky z-10 isolate transition-[top] duration-300 ease-in-out"
              style={{ top: previewStickyTop }}
            >
              <h3 className="mb-3 text-sm font-semibold tracking-tight text-slate-800 sm:text-base">
                {t('livePreview')}
              </h3>
              <Card className="rounded-2xl border-slate-200/90 bg-white shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <ListingCard
                    listing={{
                      id: 'preview',
                      title: formData.title || t('previewTitlePlaceholder'),
                      district: formData.district || t('previewDistrictPlaceholder'),
                      categorySlug: listingCategorySlug,
                      category: { slug: listingCategorySlug },
                      basePriceThb: parseFloat(String(formData.basePriceThb)) || 0,
                      base_price_thb: parseFloat(String(formData.basePriceThb)) || 0,
                      guestDisplayPriceThb:
                        pricingPreview?.storefrontGuestDisplayThb ??
                        pricingPreview?.sitePriceSameCurrency ??
                        0,
                      coverImage:
                        formData.images[0] || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image',
                      cover_image:
                        formData.images[0] || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image',
                      images:
                        formData.images.length > 0
                          ? formData.images
                          : ['https://placehold.co/600x400/e2e8f0/64748b?text=No+Image'],
                      rating: 0,
                      reviewsCount: 0,
                      reviews_count: 0,
                      metadata: formData.metadata,
                      isFeatured: false,
                      is_featured: false,
                    }}
                    currency="THB"
                    language={language}
                    exchangeRates={{ THB: 1 }}
                    onFavorite={() => {}}
                    isFavorited={false}
                  />
                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/90 p-3 text-xs leading-relaxed text-slate-600">
                    <p className="mb-1 font-medium text-slate-700">{t('thisIsHowGuestsSee')}</p>
                    <p>{t('continueFilling')}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
