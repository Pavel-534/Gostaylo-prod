'use client'

import { useCallback, useMemo } from 'react'
import { getUIText, getCategoryName } from '@/lib/translations'
import { amenitySlugsForPartnerCategory } from '@/lib/listing-wizard-amenities'
import { isTransportListingCategory, isTourListingCategory } from '@/lib/listing-category-slug'
import { isTransportWizardCategory } from '@/lib/config/category-wizard-profile-db'
import { categorySlugMatchesListingServiceType } from '@/lib/partner/listing-service-type'
import { resolveCategoryDisplayName } from '@/lib/category-display-name'
import { WIZARD_DISTRICTS } from '../wizard-constants'
import {
  computeWizardCanProceed,
  computeWizardPricingPreview,
} from './listing-wizard-step-validation'

/**
 * Stage 109.3 — derived wizard flags (category profile, steps, preview).
 */
export function useListingWizardDerived(state) {
  const { language, formData, categories, currentStep, pricingPolicy } = state

  const SEASON_TYPES = useMemo(
    () => [
      { value: 'LOW', label: getUIText('seasonLow', language), color: 'green' },
      { value: 'NORMAL', label: getUIText('seasonNormal', language), color: 'slate' },
      { value: 'HIGH', label: getUIText('seasonHigh', language), color: 'orange' },
      { value: 'PEAK', label: getUIText('seasonPeak', language), color: 'red' },
    ],
    [language],
  )

  const listingCategorySlug = useMemo(
    () => categories.find((c) => c.id === formData.categoryId)?.slug ?? '',
    [categories, formData.categoryId],
  )

  const listingCategoryWizardProfile = useMemo(() => {
    const c = categories.find((x) => x.id === formData.categoryId)
    return c?.wizardProfile ?? c?.wizard_profile ?? null
  }, [categories, formData.categoryId])

  const wizardCategoriesForSelect = useMemo(() => {
    const st = formData.listingServiceType
    if (!st) return []
    return categories.filter((c) =>
      categorySlugMatchesListingServiceType(c.slug, st, c.wizardProfile ?? c.wizard_profile),
    )
  }, [categories, formData.listingServiceType])

  const getCategoryDisplayName = useCallback(
    (cat) =>
      resolveCategoryDisplayName(cat, language, (slug, langArg, fb) =>
        getCategoryName(slug, langArg || language, fb),
      ),
    [language],
  )

  const transportWizard = useMemo(() => {
    const wp = String(listingCategoryWizardProfile || '').toLowerCase()
    if (wp === 'transport' || wp === 'transport_helicopter') return true
    return isTransportListingCategory(listingCategorySlug)
  }, [listingCategoryWizardProfile, listingCategorySlug])

  const toursWizard = useMemo(() => {
    if (String(listingCategoryWizardProfile || '').toLowerCase() === 'tour') return true
    return isTourListingCategory(listingCategorySlug)
  }, [listingCategoryWizardProfile, listingCategorySlug])

  const hideAirbnbImportBlock = transportWizard || toursWizard
  const partnerAmenitySlugs = useMemo(
    () => amenitySlugsForPartnerCategory(listingCategorySlug),
    [listingCategorySlug],
  )
  const amenitiesHintKey = transportWizard
    ? 'partnerEdit_amenitiesHintVehicle'
    : toursWizard
      ? 'partnerEdit_amenitiesHintTour'
      : 'partnerEdit_amenitiesHint'

  const coordsValid = useMemo(() => {
    const lat = formData.latitude
    const lng = formData.longitude
    if (lat == null || lng == null) return true
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  }, [formData.latitude, formData.longitude])

  const canProceed = useMemo(
    () => computeWizardCanProceed(currentStep, formData, coordsValid),
    [currentStep, formData, coordsValid],
  )

  const pricingPreview = useMemo(
    () =>
      computeWizardPricingPreview(formData.basePriceThb, pricingPolicy, {
        listingBaseCurrency: formData.baseCurrency,
        exchangeRates: state.storefrontExchangeRates,
      }),
    [formData.basePriceThb, formData.baseCurrency, pricingPolicy, state.storefrontExchangeRates],
  )

  const progress = useMemo(() => ((currentStep - 1) / 4) * 100, [currentStep])

  return {
    SEASON_TYPES,
    listingCategorySlug,
    listingCategoryWizardProfile,
    wizardCategoriesForSelect,
    getCategoryDisplayName,
    transportWizard,
    toursWizard,
    hideAirbnbImportBlock,
    partnerAmenitySlugs,
    amenitiesHintKey,
    coordsValid,
    canProceed,
    pricingPreview,
    progress,
    WIZARD_DISTRICTS,
  }
}
