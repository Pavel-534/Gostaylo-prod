'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useListingWizard } from '../context/ListingWizardContext'
import {
  buildListingDescriptionForDb,
  mergeDescriptionTranslationsForSave,
} from '@/lib/partner/listing-description-i18n'
import { normalizePartnerListingMetadata } from '@/lib/partner/listing-wizard-metadata'
import { normalizeCategoryWizardProfileColumn } from '@/lib/config/category-wizard-profile-db'
import { isTourListingCategory } from '@/lib/listing-category-slug'
import {
  migrateExternalImagesAfterSave,
  mapCoverUrlAfterMigration,
  patchPartnerListingCoverImage,
} from '@/lib/partner/migrate-external-images-client'
import {
  buildListingPublishQualityChecklist,
  formatListingQualityChecklistLabel,
  listingQualityInputFromWizardForm,
} from '@/lib/partner/listing-quality-gates.js'
import { clearWizardDraft } from '@/lib/partner/wizard-draft-storage'
import { resolvePostPublishCalendarOnboardingUrl } from '@/lib/partner/post-publish-redirect.js'

function showListingModerationToast(t) {
  toast.success(t('partnerEdit_statusPending'), {
    description: t('partnerPostListing_moderationEta'),
    duration: 10000,
  })
}

async function resolvePartnerUserId() {
  let userId = localStorage.getItem('gostaylo_user_id')
  if (userId) return userId
  try {
    const meRes = await fetch('/api/v2/auth/me', { credentials: 'include' })
    const meData = await meRes.json()
    if (meData.success && meData.user?.id) {
      const id = String(meData.user.id)
      localStorage.setItem('gostaylo_user_id', id)
      return id
    }
  } catch {
    /* ignore */
  }
  return null
}

function assertPublishQualityGate(w, t) {
  const checklist = buildListingPublishQualityChecklist(
    listingQualityInputFromWizardForm(w.formData, {
      categorySlug: w.listingCategorySlug,
      categoryName: w.formData.categoryName || '',
      wizardProfile: w.listingCategoryWizardProfile,
    }),
  )
  if (checklist.ok) return true
  const failed = checklist.items
    .filter((item) => !item.ok)
    .map((item) => formatListingQualityChecklistLabel(item, t))
  toast.error(
    t('listingQuality_publishBlocked', 'Complete the checklist before publishing'),
    {
      description: failed.slice(0, 5).join(' · '),
      duration: 12000,
    },
  )
  return false
}

/**
 * Partner listing save: draft, publish, patch (dedicated edit route).
 */
export function useListingSave() {
  const router = useRouter()
  const w = useListingWizard()
  const {
    t,
    formData,
    isEditMode,
    editId,
    draftListingIdRef,
    resolveListingIdForUpload,
    language,
    partnerCommissionRate,
    listingCategorySlug,
    listingCategoryWizardProfile,
    serverListing,
    wizardMode,
    setSavingDraft,
    setLoading,
  } = w
  const [patching, setPatching] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const buildCoverUrl = useCallback(() => {
    return formData.images[0] || formData.coverImage || null
  }, [formData.images, formData.coverImage])

  const savePatchForEdit = useCallback(async () => {
    if (!editId) return
    setPatching(true)
    try {
      const coverImage = buildCoverUrl()
      const categorySlug = listingCategorySlug
      const descTranslations = mergeDescriptionTranslationsForSave(formData, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...formData, metadata: { ...formData.metadata, description_translations: descTranslations } },
        language,
      )
      const metadata = normalizePartnerListingMetadata(
        { ...formData.metadata, description_translations: descTranslations },
        categorySlug,
        formData.categoryName || '',
        listingCategoryWizardProfile,
      )
      const tourBd =
        categorySlug &&
        (isTourListingCategory(categorySlug) ||
          normalizeCategoryWizardProfileColumn(listingCategoryWizardProfile) === 'tour')
          ? { minBookingDays: 1, maxBookingDays: 730 }
          : {
              minBookingDays: parseInt(String(formData.minBookingDays), 10) || 1,
              maxBookingDays: parseInt(String(formData.maxBookingDays), 10) || 90,
            }
      const lat = formData.latitude
      const lng = formData.longitude
      const payload = {
        title: formData.title,
        description: descriptionDb,
        basePriceThb: parseFloat(String(formData.basePriceThb)) || 0,
        baseCurrency: formData.baseCurrency || 'THB',
        categoryId: formData.categoryId,
        country: formData.country,
        region: formData.region,
        city: formData.city,
        district: formData.district,
        latitude: lat === '' || lat == null ? null : parseFloat(String(lat)),
        longitude: lng === '' || lng == null ? null : parseFloat(String(lng)),
        images: formData.images,
        coverImage,
        metadata,
        cancellationPolicy: formData.cancellationPolicy || 'moderate',
        ...tourBd,
      }
      const res = await fetch(`/api/v2/partner/listings/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (result.success) {
        toast.success(t('partnerEdit_listingSaved'), { id: 'partner-listing-save' })
        const prevCoverIdx = Math.min(
          Math.max(0, 0),
          Math.max(0, (formData.images || []).length - 1),
        )
        const mig = await migrateExternalImagesAfterSave(editId, formData.images)
        if (mig?.images?.length) {
          const newCover =
            mig.images[Math.min(prevCoverIdx, mig.images.length - 1)] || mig.images[0]
          await patchPartnerListingCoverImage(editId, newCover)
        }
      } else {
        toast.error(result.error || t('partnerEdit_listingSaveErr'))
      }
    } catch (error) {
      console.error(error)
      toast.error(t('partnerEdit_listingSaveErr'))
    } finally {
      setPatching(false)
    }
  }, [
    buildCoverUrl,
    editId,
    formData,
    language,
    listingCategorySlug,
    listingCategoryWizardProfile,
    t,
  ])

  const publishFromDraft = useCallback(async () => {
    if (!assertPublishQualityGate(w, t)) return
    if (!editId) return
    setPublishing(true)
    try {
      const coverImage = buildCoverUrl()
      const categorySlug = listingCategorySlug
      const descTranslations = mergeDescriptionTranslationsForSave(formData, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...formData, metadata: { ...formData.metadata, description_translations: descTranslations } },
        language,
      )
      const prevMeta = serverListing?.metadata && typeof serverListing.metadata === 'object' ? serverListing.metadata : {}
      const formMeta = formData.metadata && typeof formData.metadata === 'object' ? formData.metadata : {}
      const mergedMeta = {
        ...prevMeta,
        ...formMeta,
        description_translations: descTranslations,
        is_draft: false,
        published_at: new Date().toISOString(),
        ...(prevMeta.source === 'TELEGRAM_LAZY_REALTOR' ? { submitted_from: 'telegram' } : {}),
      }
      const tourBd =
        categorySlug &&
        (isTourListingCategory(categorySlug) ||
          normalizeCategoryWizardProfileColumn(listingCategoryWizardProfile) === 'tour')
          ? { minBookingDays: 1, maxBookingDays: 730 }
          : {
              minBookingDays: parseInt(String(formData.minBookingDays), 10) || 1,
              maxBookingDays: parseInt(String(formData.maxBookingDays), 10) || 90,
            }
      const lat = formData.latitude
      const lng = formData.longitude
      const res = await fetch(`/api/v2/partner/listings/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: descriptionDb,
          basePriceThb: parseFloat(String(formData.basePriceThb)) || 0,
          baseCurrency: formData.baseCurrency || 'THB',
          country: formData.country,
          region: formData.region,
          city: formData.city,
          district: formData.district,
          latitude: lat === '' || lat == null ? null : parseFloat(String(lat)),
          longitude: lng === '' || lng == null ? null : parseFloat(String(lng)),
          images: formData.images,
          coverImage,
          status: 'PENDING',
          metadata: normalizePartnerListingMetadata(
            mergedMeta,
            categorySlug,
            formData.categoryName || '',
            listingCategoryWizardProfile,
          ),
          cancellationPolicy: formData.cancellationPolicy || 'moderate',
          ...tourBd,
        }),
      })
      const result = await res.json()
      if (result.success) {
        const prevCoverIdx = Math.min(
          Math.max(0, 0),
          Math.max(0, (formData.images || []).length - 1),
        )
        const mig = await migrateExternalImagesAfterSave(editId, formData.images)
        if (mig?.images?.length) {
          const newCover =
            mig.images[Math.min(prevCoverIdx, mig.images.length - 1)] || mig.images[0]
          await patchPartnerListingCoverImage(editId, newCover)
        }
        clearWizardDraft()
        showListingModerationToast(t)
        router.push(resolvePostPublishCalendarOnboardingUrl(editId))
      } else {
        const msg = result.error || t('partnerEdit_listingPublishErr')
        const extra = Array.isArray(result.errors) ? result.errors.join(' · ') : ''
        toast.error(msg, extra ? { description: extra, duration: 12000 } : undefined)
      }
    } catch (error) {
      console.error(error)
      toast.error(t('partnerEdit_listingPublishErr'))
    } finally {
      setPublishing(false)
    }
  }, [
    buildCoverUrl,
    editId,
    formData,
    language,
    listingCategorySlug,
    listingCategoryWizardProfile,
    router,
    serverListing,
    t,
  ])

  const saveDraft = useCallback(async () => {
    if (wizardMode === 'edit') {
      return savePatchForEdit()
    }
    setSavingDraft(true)
    try {
      const userId = await resolvePartnerUserId()
      if (!userId) {
        toast.error(t('pleaseLogIn'))
        return
      }
      const categorySlug = listingCategorySlug
      const tourCat =
        isTourListingCategory(categorySlug) ||
        normalizeCategoryWizardProfileColumn(listingCategoryWizardProfile) === 'tour'
      const bookingDaysPayload = tourCat
        ? { minBookingDays: 1, maxBookingDays: 730 }
        : {
            minBookingDays: parseInt(String(formData.minBookingDays), 10) || 1,
            maxBookingDays: parseInt(String(formData.maxBookingDays), 10) || 90,
          }
      const descTranslations = mergeDescriptionTranslationsForSave(formData, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...formData, metadata: { ...formData.metadata, description_translations: descTranslations } },
        language,
      )
      const draftMeta = normalizePartnerListingMetadata(
        { ...formData.metadata, description_translations: descTranslations, is_draft: true },
        categorySlug,
        formData.categoryName || '',
        listingCategoryWizardProfile,
      )

      if (isEditMode && editId) {
        const payload = {
          ...formData,
          ...bookingDaysPayload,
          description: descriptionDb,
          status: formData.status || 'INACTIVE',
          available: false,
          basePriceThb: parseFloat(String(formData.basePriceThb)) || 0,
          baseCurrency: formData.baseCurrency || 'THB',
          images: formData.images,
          metadata: draftMeta,
        }
        const res = await fetch(`/api/v2/partner/listings/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (data.success) {
          const lid = editId
          const mig = await migrateExternalImagesAfterSave(lid, formData.images)
          if (mig?.images?.length) {
            const cover = mapCoverUrlAfterMigration(formData.images, formData.coverImage, mig.images)
            if (cover) await patchPartnerListingCoverImage(lid, cover)
          }
          clearWizardDraft()
          toast.success(t('draftSaved'))
          router.push('/partner/listings')
        } else {
          toast.error(data.error || t('failedToLoadListing'))
        }
      } else {
        const payload = {
          ownerId: userId,
          categoryId: formData.categoryId,
          title: formData.title || t('draftDefaultTitle'),
          description: descriptionDb,
          district: formData.district || '',
          basePriceThb: parseFloat(String(formData.basePriceThb)) || 0,
          baseCurrency: formData.baseCurrency || 'THB',
          images: formData.images || [],
          metadata: draftMeta,
          status: 'INACTIVE',
          available: false,
        }
        const res = await fetch('/api/v2/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (data.success) {
          const lid = data.data?.id
          const mig = await migrateExternalImagesAfterSave(lid, formData.images)
          if (mig?.images?.length) {
            const cover = mapCoverUrlAfterMigration(formData.images, formData.coverImage, mig.images)
            if (cover) await patchPartnerListingCoverImage(lid, cover)
          }
          clearWizardDraft()
          toast.success(t('draftSaved'))
          if (lid) {
            router.replace(`/partner/listings/new?edit=${encodeURIComponent(lid)}`)
          } else {
            router.push('/partner/listings')
          }
        } else {
          toast.error(data.error || t('failedToLoadListing'))
        }
      }
    } catch (error) {
      toast.error(t('failedToLoadListing'))
    } finally {
      setSavingDraft(false)
    }
  }, [
    editId,
    formData,
    isEditMode,
    language,
    listingCategorySlug,
    listingCategoryWizardProfile,
    router,
    savePatchForEdit,
    setSavingDraft,
    t,
    wizardMode,
  ])

  const publishListing = useCallback(async () => {
    if (wizardMode === 'edit' && isEditMode) {
      if (serverListing?.metadata?.is_draft) {
        return publishFromDraft()
      }
      return savePatchForEdit()
    }
    if (!assertPublishQualityGate(w, t)) return
    setLoading(true)
    try {
      const userId = await resolvePartnerUserId()
      if (!userId) {
        toast.error(t('pleaseLogIn'))
        return
      }
      const categorySlug = listingCategorySlug
      const tourCat =
        isTourListingCategory(categorySlug) ||
        normalizeCategoryWizardProfileColumn(listingCategoryWizardProfile) === 'tour'
      const bookingDaysPayload = tourCat
        ? { minBookingDays: 1, maxBookingDays: 730 }
        : {
            minBookingDays: parseInt(String(formData.minBookingDays), 10) || 1,
            maxBookingDays: parseInt(String(formData.maxBookingDays), 10) || 90,
          }
      const descTranslations = mergeDescriptionTranslationsForSave(formData, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...formData, metadata: { ...formData.metadata, description_translations: descTranslations } },
        language,
      )
      const publishMeta = normalizePartnerListingMetadata(
        { ...formData.metadata, description_translations: descTranslations, is_draft: false },
        categorySlug,
        formData.categoryName || '',
        listingCategoryWizardProfile,
      )
      const payload = {
        ...formData,
        description: descriptionDb,
        ownerId: userId,
        status: 'PENDING',
        available: true,
        basePriceThb: parseFloat(String(formData.basePriceThb)) || 0,
        baseCurrency: formData.baseCurrency || 'THB',
        commissionRate: Number.isFinite(parseFloat(String(formData.commissionRate)))
          ? parseFloat(String(formData.commissionRate))
          : partnerCommissionRate,
        ...bookingDaysPayload,
        metadata: publishMeta,
      }
      let publishListingId = editId || draftListingIdRef?.current || null
      if (!publishListingId && typeof resolveListingIdForUpload === 'function') {
        publishListingId = await resolveListingIdForUpload()
      }
      if (!publishListingId) {
        toast.error(t('listingQuality_saveDraftFirst', 'Save a draft before publishing'))
        return
      }
      const res = await fetch(`/api/v2/partner/listings/${publishListingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: payload.title,
          description: payload.description,
          basePriceThb: payload.basePriceThb,
          baseCurrency: payload.baseCurrency,
          country: formData.country,
          region: formData.region,
          city: formData.city,
          district: payload.district,
          latitude: formData.latitude === '' || formData.latitude == null ? null : parseFloat(String(formData.latitude)),
          longitude: formData.longitude === '' || formData.longitude == null ? null : parseFloat(String(formData.longitude)),
          images: payload.images,
          coverImage: buildCoverUrl(),
          status: 'PENDING',
          metadata: payload.metadata,
          cancellationPolicy: formData.cancellationPolicy || 'moderate',
          ...bookingDaysPayload,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const listingId = data.data?.id || data.listing?.id || publishListingId
        const mig = await migrateExternalImagesAfterSave(listingId, formData.images)
        if (mig?.images?.length) {
          const cover = mapCoverUrlAfterMigration(formData.images, formData.coverImage, mig.images)
          if (cover) await patchPartnerListingCoverImage(listingId, cover)
        }
        const seasons = formData.seasonalPricing || []
        if (listingId && seasons.length > 0) {
          for (const s of seasons) {
            try {
              await fetch('/api/v2/partner/seasonal-prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                  listingId,
                  startDate: s.startDate,
                  endDate: s.endDate,
                  priceDaily: s.priceDaily,
                  priceMonthly: s.priceMonthly || null,
                  label: s.label || t('defaultListingSeasonLabel'),
                  seasonType: (s.seasonType || 'NORMAL').toUpperCase(),
                }),
              })
            } catch (e) {
              console.warn('Seasonal price save failed:', e)
            }
          }
        }
        clearWizardDraft()
        showListingModerationToast(t)
        router.push(resolvePostPublishCalendarOnboardingUrl(listingId))
      } else {
        const msg = data.error || t('failedToLoadListing')
        const extra = Array.isArray(data.errors) ? data.errors.join(' · ') : ''
        toast.error(msg, extra ? { description: extra, duration: 12000 } : undefined)
      }
    } catch (error) {
      toast.error(t('failedToLoadListing'))
    } finally {
      setLoading(false)
    }
  }, [
    w,
    buildCoverUrl,
    draftListingIdRef,
    editId,
    formData,
    isEditMode,
    language,
    listingCategorySlug,
    listingCategoryWizardProfile,
    partnerCommissionRate,
    publishFromDraft,
    resolveListingIdForUpload,
    router,
    serverListing,
    setLoading,
    t,
    wizardMode,
  ])

  return {
    saveDraft,
    publishListing,
    savePatchForEdit,
    patching,
    publishing,
  }
}
