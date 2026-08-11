'use client'

import React, { createContext, useContext } from 'react'
import { getCategoryName, getAmenityName } from '@/lib/translations'
import { WIZARD_DISTRICTS } from '../wizard-constants'
import { useListingWizardState } from '../hooks/useListingWizardState'
import { useListingWizardDerived } from '../hooks/useListingWizardDerived'
import { useListingWizardActions } from '../hooks/useListingWizardActions'

const ListingWizardContext = createContext(null)

export { WIZARD_DISTRICTS }

/**
 * Wizard: (1) general (2) location (3) photos (4) pricing (5) calendar (6) preview.
 * Stage 109.3 — composition via thematic hooks; Stage 200.92 — six steps.
 */
export function ListingWizardProvider({ children, initialListingId = null, mode: wizardMode = 'create' }) {
  const state = useListingWizardState({ initialListingId, wizardMode })
  const derived = useListingWizardDerived(state)
  const actions = useListingWizardActions(state, derived)

  const value = {
    language: state.language,
    t: state.t,
    tr: state.tr,
    numberLocale: state.numberLocale,
    wizardMode: state.wizardMode,
    serverListing: state.serverListing,
    listingNotFound: state.listingNotFound,
    authLoading: state.authLoading,
    isAuthenticated: state.isAuthenticated,
    getCategoryName: (slug, l) => getCategoryName(slug, l || state.language),
    getCategoryDisplayName: derived.getCategoryDisplayName,
    getAmenityName: (slug, l) => getAmenityName(slug, l || state.language),
    editId: state.editId,
    isEditMode: state.isEditMode,
    currentStep: state.currentStep,
    setCurrentStep: state.setCurrentStep,
    isDirty: state.isDirty,
    draftRestored: state.draftRestored,
    showResumeDraftBanner: state.showResumeDraftBanner,
    dismissResumeDraftBanner: state.dismissResumeDraftBanner,
    startFreshWizard: state.startFreshWizard,
    loading: state.loading,
    setLoading: state.setLoading,
    savingDraft: state.savingDraft,
    setSavingDraft: state.setSavingDraft,
    uploading: state.uploading,
    uploadProgress: state.uploadProgress,
    fileInputRef: state.fileInputRef,
    formData: state.formData,
    setFormData: state.setFormData,
    categories: state.categories,
    setCategories: state.setCategories,
    customDistricts: state.customDistricts,
    setCustomDistricts: state.setCustomDistricts,
    newSeason: state.newSeason,
    setNewSeason: state.setNewSeason,
    partnerCommissionRate: state.partnerCommissionRate,
    setPartnerCommissionRate: state.setPartnerCommissionRate,
    pricingPolicy: state.pricingPolicy,
    setPricingPolicy: state.setPricingPolicy,
    aiDescQuota: state.aiDescQuota,
    aiDescriptionLoading: state.aiDescriptionLoading,
    handleAiImproveDescription: actions.handleAiImproveDescription,
    handleAiTranslateDescription: actions.handleAiTranslateDescription,
    updateField: actions.updateField,
    updateDescription: actions.updateDescription,
    updateMetadata: actions.updateMetadata,
    updateDurationDiscountPercent: actions.updateDurationDiscountPercent,
    setCategoryId: actions.setCategoryId,
    setListingServiceType: actions.setListingServiceType,
    wizardCategoriesForSelect: derived.wizardCategoriesForSelect,
    listingCategorySlug: derived.listingCategorySlug,
    listingCategoryWizardProfile: derived.listingCategoryWizardProfile,
    transportWizard: derived.transportWizard,
    toursWizard: derived.toursWizard,
    baseCurrencyLocked:
      state.serverListing?.financialLock?.baseCurrencyLocked === true ||
      state.serverListing?.financialLock?.locked === true,
    partnerAmenitySlugs: derived.partnerAmenitySlugs,
    amenitiesHintKey: derived.amenitiesHintKey,
    canProceed: derived.canProceed,
    stepBlockers: derived.stepBlockers,
    stepFieldErrors: derived.stepFieldErrors,
    publishQualityChecklist: derived.publishQualityChecklist,
    canFullPublish: derived.canFullPublish,
    canSoftPublish: derived.canSoftPublish,
    progress: derived.progress,
    goNext: actions.goNext,
    goBack: actions.goBack,
    SEASON_TYPES: derived.SEASON_TYPES,
    dayPickerLocale: state.dayPickerLocale,
    geocodeQuery: state.geocodeQuery,
    setGeocodeQuery: state.setGeocodeQuery,
    geocodeResults: state.geocodeResults,
    setGeocodeResults: state.setGeocodeResults,
    geocoding: state.geocoding,
    setGeocoding: state.setGeocoding,
    handleGeocode: actions.handleGeocode,
    selectGeocodeResult: actions.selectGeocodeResult,
    handleMapSelect: actions.handleMapSelect,
    coordsValid: derived.coordsValid,
    pricingPreview: derived.pricingPreview,
    draftListingIdRef: state.draftListingIdRef,
    resolveListingIdForUpload: actions.resolveListingIdForUpload,
    ensureCalendarListingReady: actions.ensureCalendarListingReady,
    handleImageUpload: actions.handleImageUpload,
    removeImage: actions.removeImage,
    reorderImages: actions.reorderImages,
    WIZARD_DISTRICTS: derived.WIZARD_DISTRICTS,
    refreshAiDescriptionQuota: actions.refreshAiDescriptionQuota,
  }

  return <ListingWizardContext.Provider value={value}>{children}</ListingWizardContext.Provider>
}

export function useListingWizard() {
  const ctx = useContext(ListingWizardContext)
  if (!ctx) {
    throw new Error('useListingWizard must be used within ListingWizardProvider')
  }
  return ctx
}
