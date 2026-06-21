'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Home,
  Map as MapIcon,
  DollarSign,
  ImageIcon,
  Loader2,
  Send,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ListingCard } from '@/components/listing-card'
import { useListingWizard } from '../context/ListingWizardContext'
import { useListingSave } from '../hooks/useListingSave'
import { StepGeneralInfo } from './StepGeneralInfo'
import { StepLocation } from './StepLocation'
import { StepPhotos } from './StepPhotos'
import { StepPricing } from './StepPricing'
import { StepPreview } from './StepPreview'
import { PartnerReferralWizardBanner } from '@/components/partner/PartnerReferralWizardBanner'
import {
  PartnerListingStatusBadge,
  partnerWizardListingStatusTone,
} from '@/components/partner/PartnerListingStatusBadge'
import { WORKSPACE_SCROLL_STICKY_CLASS } from '@/lib/layout/workspace-shell'

export function ListingWizardPageInner() {
  const router = useRouter()
  const w = useListingWizard()
  const { saveDraft, publishListing, patching, publishing } = useListingSave()
  const {
    t,
    isEditMode,
    wizardMode,
    serverListing,
    currentStep,
    loading,
    savingDraft,
    formData,
    language,
    listingCategorySlug,
    progress,
    canProceed,
    goNext,
    goBack,
    pricingPreview,
    isDirty,
    draftRestored,
  } = w

  /** Stage 140.1 — warn before losing an unsaved new-listing draft. */
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

  /** Stage 140.1 — let the host know their progress was recovered (once). */
  const restoreToastShownRef = useRef(false)
  useEffect(() => {
    if (draftRestored && !restoreToastShownRef.current) {
      restoreToastShownRef.current = true
      toast.success(t('wizardDraftRestored'))
    }
  }, [draftRestored, t])

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
      { id: 1, label: t('basics'), icon: Home },
      { id: 2, label: t('location'), icon: MapIcon },
      { id: 3, label: t('gallery'), icon: ImageIcon },
      { id: 4, label: t('pricing'), icon: DollarSign },
      { id: 5, label: t('livePreview'), icon: CheckCircle2 },
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

  return (
    <div className="min-h-0 bg-slate-50">
      <div className={WORKSPACE_SCROLL_STICKY_CLASS}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <Button
              variant="ghost"
              onClick={() => router.push('/partner/listings')}
              className="gap-2"
              type="button"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('exit')}
            </Button>
            <h1 className="text-center text-lg font-semibold tracking-tight sm:text-xl">{headerTitle}</h1>
            <div className="flex items-center justify-end gap-2">
              {isEditRoute && serverListing && (
                <PartnerListingStatusBadge
                  tone={partnerWizardListingStatusTone({
                    isDraft,
                    status: serverListing.status,
                  })}
                >
                  {isDraft
                    ? t('partnerEdit_statusDraft')
                    : serverListing.status === 'ACTIVE'
                      ? t('partnerEdit_statusActive')
                      : serverListing.status === 'PENDING'
                        ? t('partnerEdit_statusPending')
                        : t('partnerEdit_statusInactive')}
                </PartnerListingStatusBadge>
              )}
              <Button
                variant="outline"
                onClick={saveDraft}
                disabled={saveBusy}
                className="gap-2"
                type="button"
              >
                {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEditRoute ? t('partnerEdit_save') : t('saveDraft')}
              </Button>
              {isEditRoute && isDraft && (
                <Button
                  onClick={publishListing}
                  disabled={!canProceed || lastStepBusy}
                  variant="brand"
                  className="hidden gap-2 sm:inline-flex"
                  type="button"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {t('partnerEdit_publish')}
                </Button>
              )}
            </div>
          </div>
          <div className="pb-4">
            <Progress value={progress} className="h-2" />
            <div className="mt-3 flex items-center justify-between">
              {STEPS.map((step) => {
                const Icon = step.icon
                const isActive = currentStep === step.id
                const isComplete = currentStep > step.id
                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                        isComplete
                          ? 'border-brand bg-brand text-white'
                          : isActive
                            ? 'border-brand bg-white text-brand'
                            : 'border-slate-300 bg-white text-slate-400'
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span className={`mt-1 text-xs font-medium ${isActive ? 'text-brand' : 'text-slate-500'}`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {!isEditRoute ? <PartnerReferralWizardBanner className="mb-6" /> : null}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5 sm:p-8">
                {stepContent}
                <Separator className="my-8" />
                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={goBack} disabled={currentStep === 1} className="gap-2" type="button">
                    <ArrowLeft className="h-4 w-4" />
                    {t('back')}
                  </Button>
                  {currentStep < 5 ? (
                    <Button
                      onClick={goNext}
                      disabled={!canProceed}
                      variant="brand"
                      className="gap-2"
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
                      className="gap-2"
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
          </div>
          <div className="lg:col-span-1">
            <div className="sticky top-4 z-20 isolate">
              <h3 className="mb-4 text-lg font-semibold tracking-tight text-slate-800">{t('livePreview')}</h3>
              <Card className="border-slate-200 bg-white shadow-sm">
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
                      coverImage: formData.images[0] || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image',
                      cover_image: formData.images[0] || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image',
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
