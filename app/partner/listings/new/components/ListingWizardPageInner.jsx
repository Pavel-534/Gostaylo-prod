'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
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
import { Badge } from '@/components/ui/badge'
import { GostayloListingCard } from '@/components/gostaylo-listing-card'
import { useListingWizard } from '../context/ListingWizardContext'
import { useListingSave } from '../hooks/useListingSave'
import { StepGeneralInfo } from './StepGeneralInfo'
import { StepLocation } from './StepLocation'
import { StepPhotos } from './StepPhotos'
import { StepPricing } from './StepPricing'
import { StepPreview } from './StepPreview'

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
  } = w

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
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white">
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
                <Badge
                  className={`text-xs ${
                    isDraft ? 'border-amber-300 bg-amber-100 text-amber-700' : ''
                  } ${
                    !isDraft && serverListing.status === 'ACTIVE'
                      ? 'bg-green-100 text-green-700'
                      : !isDraft && serverListing.status === 'PENDING'
                        ? 'bg-yellow-100 text-yellow-700'
                        : !isDraft
                          ? 'bg-slate-100 text-slate-700'
                          : ''
                  }`}
                >
                  {isDraft
                    ? t('partnerEdit_statusDraft')
                    : serverListing.status === 'ACTIVE'
                      ? t('partnerEdit_statusActive')
                      : serverListing.status === 'PENDING'
                        ? t('partnerEdit_statusPending')
                        : t('partnerEdit_statusInactive')}
                </Badge>
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
                  className="hidden gap-2 bg-teal-600 hover:bg-teal-700 sm:inline-flex"
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
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : isActive
                            ? 'border-teal-600 bg-white text-teal-600'
                            : 'border-slate-300 bg-white text-slate-400'
                      }`}
                    >
                      {isComplete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span className={`mt-1 text-xs font-medium ${isActive ? 'text-teal-600' : 'text-slate-500'}`}>
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
                      className="gap-2 bg-teal-600 hover:bg-teal-700"
                      type="button"
                    >
                      {t('next')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={publishListing}
                      disabled={!canProceed || lastStepBusy}
                      className="gap-2 bg-teal-600 hover:bg-teal-700"
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
            <div className="sticky top-24">
              <h3 className="mb-4 text-lg font-semibold tracking-tight text-slate-800">{t('livePreview')}</h3>
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <GostayloListingCard
                    listing={{
                      id: 'preview',
                      title: formData.title || t('previewTitlePlaceholder'),
                      district: formData.district || t('previewDistrictPlaceholder'),
                      categorySlug: listingCategorySlug,
                      category: { slug: listingCategorySlug },
                      basePriceThb: parseFloat(String(formData.basePriceThb)) || 0,
                      base_price_thb: parseFloat(String(formData.basePriceThb)) || 0,
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
