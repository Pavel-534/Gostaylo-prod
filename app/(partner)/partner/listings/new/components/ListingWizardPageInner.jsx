'use client'

import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useListingWizard } from '../context/ListingWizardContext'
import { StepGeneralInfo } from './StepGeneralInfo'
import { StepLocation } from './StepLocation'
import { StepPhotos } from './StepPhotos'
import { StepPricing } from './StepPricing'
import { StepPreview } from './StepPreview'
import { StepCalendarSection } from './StepCalendarSection'
import { ListingWizardChrome } from './chrome/ListingWizardChrome'
import { ListingWizardStepFooter } from './chrome/ListingWizardStepFooter'
import { ListingWizardMobileActionBar } from './chrome/ListingWizardMobileActionBar'
import { ListingWizardPreviewPanel } from './preview/ListingWizardPreviewPanel'
import {
  WIZARD_COMPACT_STEP_INDICATOR_HEIGHT,
  WIZARD_MOBILE_CHROME_PT_CLASS,
  WIZARD_MOBILE_CONTENT_PB_CLASS,
  formatWizardStepMarkerLabel,
} from './chrome/listing-wizard-layout'
import { PartnerReferralWizardBanner } from '@/components/partner/PartnerReferralWizardBanner'
import { LISTING_WIZARD_STEP_COUNT } from '../wizard-constants'
import { useWorkspaceScrollTrigger } from '@/lib/hooks/use-workspace-scroll-trigger'
import { LISTING_WIZARD_STICKY_TOP_EXPANDED } from '@/lib/layout/workspace-shell'

export function ListingWizardPageInner() {
  const w = useListingWizard()
  const {
    t,
    isEditMode,
    wizardMode,
    editId,
    serverListing,
    currentStep,
    setCurrentStep,
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

  const { isScrolled, anchorRef } = useWorkspaceScrollTrigger({ threshold: 20 })

  const stepMarker = t('wizardStepMarker')
    .replace('{current}', String(currentStep))
    .replace('{total}', String(LISTING_WIZARD_STEP_COUNT))

  const currentStepLabel = STEPS.find((s) => s.id === currentStep)?.label ?? ''
  const compactStepLine = `${stepMarker}: ${currentStepLabel}`
  const stepMarkerLabel = formatWizardStepMarkerLabel(stepMarker)

  const previewStickyTop = isScrolled
    ? WIZARD_COMPACT_STEP_INDICATOR_HEIGHT
    : LISTING_WIZARD_STICKY_TOP_EXPANDED

  return (
    <div ref={anchorRef} className="w-full bg-slate-50">
      <ListingWizardChrome
        isScrolled={isScrolled}
        steps={STEPS}
        currentStep={currentStep}
        compactStepLine={compactStepLine}
        headerTitle={headerTitle}
        currentStepLabel={currentStepLabel}
        stepMarkerLabel={stepMarkerLabel}
        onStepSelect={setCurrentStep}
      />

      <div
        className={`relative z-0 mx-auto max-w-7xl px-4 ${WIZARD_MOBILE_CHROME_PT_CLASS} sm:pt-6 sm:px-6 ${WIZARD_MOBILE_CONTENT_PB_CLASS} sm:pb-10 lg:px-8`}
      >
        {!isEditRoute ? <PartnerReferralWizardBanner className="mb-6" /> : null}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card className="rounded-2xl border-slate-200/90 bg-white shadow-sm">
              <CardContent className="p-4 sm:p-8">
                <div className="relative z-0">{stepContent}</div>
                <Separator className="my-8 hidden sm:block" />
                <ListingWizardStepFooter />
              </CardContent>
            </Card>

            {isEditRoute && editId && serverListing ? <StepCalendarSection /> : null}
          </div>

          <ListingWizardPreviewPanel previewStickyTop={previewStickyTop} />
        </div>
      </div>

      <ListingWizardMobileActionBar />
    </div>
  )
}
