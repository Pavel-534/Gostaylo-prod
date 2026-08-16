'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
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
  validateListingSoftPublishQuality,
} from '@/lib/partner/listing-quality-gates.js'
import { clearWizardDraft } from '@/lib/partner/wizard-draft-storage'
import { resolvePostPublishCalendarOnboardingUrl } from '@/lib/partner/post-publish-redirect.js'
import { ensureProvisionalCityCode } from '@/lib/geo/wizard-ensure-provisional'
import { assertInstantBookingCalendarPolicy } from '@/lib/ical/instant-booking-ical-policy.js'
import { isConciergeImportListing } from '@/lib/partner/concierge-listing-ui.js'
import { refreshPartnerListingsAfterSave } from '@/lib/hooks/use-partner-listings'

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

function assertSoftPublishQualityGate(w, t) {
  const quality = validateListingSoftPublishQuality(
    listingQualityInputFromWizardForm(w.formData, {
      categorySlug: w.listingCategorySlug,
      categoryName: w.formData.categoryName || '',
      wizardProfile: w.listingCategoryWizardProfile,
    }),
  )
  if (quality.ok) return true
  toast.error(t('listingQuality_softPublishBlocked', 'Not enough for soft publish yet'), {
    description: (quality.errors || []).slice(0, 4).join(' · '),
    duration: 12000,
  })
  return false
}

function assertInstantBookingGate(w, t) {
  const syncSettings =
    w.serverListing?.sync_settings || w.serverListing?.syncSettings || w.formData?.sync_settings || null
  const gate = assertInstantBookingCalendarPolicy({
    instantBooking: w.formData?.instantBooking === true,
    metadata: w.formData?.metadata,
    syncSettings,
  })
  if (gate.ok) return true
  const blockedKey = w.transportWizard
    ? 'partnerListing_instantBookingBlockedVehicle'
    : 'partnerListing_instantBookingBlocked'
  toast.error(t(blockedKey), { duration: 10000 })
  return false
}

/** Stage 200.36 — upsert provisional city_code before write when label-only. */
async function resolveFormDataWithProvisionalCity(formData, setFormData, t) {
  const result = await ensureProvisionalCityCode(formData)
  if (!result.ok) {
    if (result.error === 'city_required') {
      toast.error(t('wizardBlocker_city'))
    } else if (result.error === 'country_required') {
      toast.error(t('wizardBlocker_country'))
    } else {
      toast.error(t('wizardGeo_provisionalFailed'))
    }
    return null
  }
  if (result.formData && result.formData !== formData && typeof setFormData === 'function') {
    setFormData(result.formData)
  }
  return result.formData
}

/** Only include lat/lng when set — omit null so draft saves do not clear an existing pin. */
function coordsPayloadFromForm(geoForm) {
  const lat =
    geoForm.latitude === '' || geoForm.latitude == null
      ? null
      : parseFloat(String(geoForm.latitude))
  const lng =
    geoForm.longitude === '' || geoForm.longitude == null
      ? null
      : parseFloat(String(geoForm.longitude))
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng }
  }
  return {}
}

/** Stage 201.64 — partial draft: only send geo when country is a real ISO code. */
function optionalDraftGeoFields(form) {
  const country = String(form?.country || '')
    .trim()
    .toUpperCase()
    .slice(0, 2)
  const out = { ...coordsPayloadFromForm(form) }
  if (!/^[A-Z]{2}$/.test(country)) return out
  out.country = country
  const region = String(form?.region || '').trim()
  const city = String(form?.city || form?.metadata?.city || '').trim()
  const district = String(form?.district || '').trim()
  if (region) out.region = region
  if (city) out.city = city
  if (district) out.district = district
  return out
}

function isWizardServerDraft(serverListing, formData) {
  const m = serverListing?.metadata || formData?.metadata || {}
  return m.is_draft === true || m.is_draft === 'true'
}

async function invalidatePartnerListingsCache(queryClient, opts = {}) {
  try {
    await refreshPartnerListingsAfterSave(queryClient, opts)
  } catch {
    /* ignore */
  }
}

function listingsCacheOptsFromForm(listingId, geoForm) {
  const n = parseFloat(String(geoForm?.basePriceThb ?? '').replace(',', '.'))
  return {
    listingId: listingId || null,
    basePriceAssetAmount: Number.isFinite(n) ? n : null,
    baseCurrency: geoForm?.baseCurrency || null,
  }
}

/**
 * Partner listing save: draft, publish, patch (dedicated edit route).
 */
export function useListingSave() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const w = useListingWizard()
  const {
    t,
    formData,
    setFormData,
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
    markWizardCleanForLeave,
  } = w
  const [patching, setPatching] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const buildCoverUrl = useCallback(() => {
    return formData.images[0] || formData.coverImage || null
  }, [formData.images, formData.coverImage])

  const savePatchForEdit = useCallback(async () => {
    if (!editId) return
    if (!assertInstantBookingGate({ formData, serverListing }, t)) return
    setPatching(true)
    try {
      const geoForm = await resolveFormDataWithProvisionalCity(formData, setFormData, t)
      if (!geoForm) return
      const coverImage = buildCoverUrl()
      const categorySlug = listingCategorySlug
      const descTranslations = mergeDescriptionTranslationsForSave(geoForm, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...geoForm, metadata: { ...geoForm.metadata, description_translations: descTranslations } },
        language,
      )
      const metadata = normalizePartnerListingMetadata(
        { ...geoForm.metadata, description_translations: descTranslations },
        categorySlug,
        geoForm.categoryName || '',
        listingCategoryWizardProfile,
      )
      const tourBd =
        categorySlug &&
        (isTourListingCategory(categorySlug) ||
          normalizeCategoryWizardProfileColumn(listingCategoryWizardProfile) === 'tour')
          ? { minBookingDays: 1, maxBookingDays: 730 }
          : {
              minBookingDays: parseInt(String(geoForm.minBookingDays), 10) || 1,
              maxBookingDays: parseInt(String(geoForm.maxBookingDays), 10) || 90,
            }
      const payload = {
        title: geoForm.title,
        description: descriptionDb,
        basePriceThb: parseFloat(String(geoForm.basePriceThb)) || 0,
        baseCurrency: geoForm.baseCurrency || 'THB',
        categoryId: geoForm.categoryId,
        country: geoForm.country,
        region: geoForm.region,
        city: geoForm.city,
        district: geoForm.district,
        ...coordsPayloadFromForm(geoForm),
        images: geoForm.images,
        coverImage,
        metadata,
        cancellationPolicy: geoForm.cancellationPolicy || 'moderate',
        instantBooking: geoForm.instantBooking === true,
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
          Math.max(0, (geoForm.images || []).length - 1),
        )
        const mig = await migrateExternalImagesAfterSave(editId, geoForm.images)
        if (mig?.images?.length) {
          const newCover =
            mig.images[Math.min(prevCoverIdx, mig.images.length - 1)] || mig.images[0]
          await patchPartnerListingCoverImage(editId, newCover)
        }
        await invalidatePartnerListingsCache(queryClient, listingsCacheOptsFromForm(editId, geoForm))
        markWizardCleanForLeave?.()
        clearWizardDraft()
        router.push('/partner/listings')
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
    setFormData,
    language,
    listingCategorySlug,
    listingCategoryWizardProfile,
    queryClient,
    router,
    serverListing,
    t,
  ])

  const publishFromDraft = useCallback(async ({ soft = false } = {}) => {
    if (!assertInstantBookingGate({ formData, serverListing }, t)) return
    if (soft) {
      if (!assertSoftPublishQualityGate(w, t)) return
    } else if (!assertPublishQualityGate(w, t)) {
      return
    }
    if (!editId) return
    setPublishing(true)
    try {
      const geoForm = await resolveFormDataWithProvisionalCity(formData, setFormData, t)
      if (!geoForm) return
      const coverImage = buildCoverUrl()
      const categorySlug = listingCategorySlug
      const descTranslations = mergeDescriptionTranslationsForSave(geoForm, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...geoForm, metadata: { ...geoForm.metadata, description_translations: descTranslations } },
        language,
      )
      const prevMeta = serverListing?.metadata && typeof serverListing.metadata === 'object' ? serverListing.metadata : {}
      const formMeta = geoForm.metadata && typeof geoForm.metadata === 'object' ? geoForm.metadata : {}
      const mergedMeta = {
        ...prevMeta,
        ...formMeta,
        description_translations: descTranslations,
        is_draft: false,
        published_at: new Date().toISOString(),
        ...(soft ? { soft_publish: true } : { soft_publish: false, quality_incomplete: false }),
        ...(prevMeta.source === 'TELEGRAM_LAZY_REALTOR' ? { submitted_from: 'telegram' } : {}),
        ...(isConciergeImportListing(serverListing) ? { concierge_stage: 'submitted' } : {}),
      }
      const tourBd =
        categorySlug &&
        (isTourListingCategory(categorySlug) ||
          normalizeCategoryWizardProfileColumn(listingCategoryWizardProfile) === 'tour')
          ? { minBookingDays: 1, maxBookingDays: 730 }
          : {
              minBookingDays: parseInt(String(geoForm.minBookingDays), 10) || 1,
              maxBookingDays: parseInt(String(geoForm.maxBookingDays), 10) || 90,
            }
      const res = await fetch(`/api/v2/partner/listings/${editId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: geoForm.title,
          description: descriptionDb,
          basePriceThb: parseFloat(String(geoForm.basePriceThb)) || 0,
          baseCurrency: geoForm.baseCurrency || 'THB',
          country: geoForm.country,
          region: geoForm.region,
          city: geoForm.city,
          district: geoForm.district,
          ...coordsPayloadFromForm(geoForm),
          images: geoForm.images,
          coverImage,
          status: 'PENDING',
          softPublish: soft,
          metadata: normalizePartnerListingMetadata(
            mergedMeta,
            categorySlug,
            geoForm.categoryName || '',
            listingCategoryWizardProfile,
          ),
          cancellationPolicy: geoForm.cancellationPolicy || 'moderate',
          instantBooking: geoForm.instantBooking === true,
          ...tourBd,
        }),
      })
      const result = await res.json()
      if (result.success) {
        const prevCoverIdx = Math.min(
          Math.max(0, 0),
          Math.max(0, (geoForm.images || []).length - 1),
        )
        const mig = await migrateExternalImagesAfterSave(editId, geoForm.images)
        if (mig?.images?.length) {
          const newCover =
            mig.images[Math.min(prevCoverIdx, mig.images.length - 1)] || mig.images[0]
          await patchPartnerListingCoverImage(editId, newCover)
        }
        markWizardCleanForLeave?.()
        clearWizardDraft()
        await invalidatePartnerListingsCache(queryClient, listingsCacheOptsFromForm(editId, geoForm))
        if (soft) {
          toast.success(t('listingQuality_softPublishOk'), {
            description: t('listingQuality_softPublishOkHint'),
            duration: 10000,
          })
        } else {
          showListingModerationToast(t)
        }
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
    setFormData,
    language,
    listingCategorySlug,
    listingCategoryWizardProfile,
    queryClient,
    router,
    serverListing,
    t,
    w,
  ])

  const softPublishListing = useCallback(async () => {
    if (wizardMode === 'edit' && isEditMode) {
      return publishFromDraft({ soft: true })
    }
    if (!assertInstantBookingGate({ formData, serverListing }, t)) return
    if (!assertSoftPublishQualityGate(w, t)) return
    setPublishing(true)
    try {
      let publishListingId = editId || draftListingIdRef?.current || null
      if (!publishListingId && typeof resolveListingIdForUpload === 'function') {
        publishListingId = await resolveListingIdForUpload()
      }
      if (!publishListingId) {
        toast.error(t('listingQuality_saveDraftFirst', 'Save a draft before publishing'))
        return
      }
      const coverImage = buildCoverUrl()
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
        {
          ...formData.metadata,
          description_translations: descTranslations,
          is_draft: false,
          soft_publish: true,
          published_at: new Date().toISOString(),
        },
        categorySlug,
        formData.categoryName || '',
        listingCategoryWizardProfile,
      )
      const res = await fetch(`/api/v2/partner/listings/${publishListingId}`, {
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
          latitude:
            formData.latitude === '' || formData.latitude == null
              ? null
              : parseFloat(String(formData.latitude)),
          longitude:
            formData.longitude === '' || formData.longitude == null
              ? null
              : parseFloat(String(formData.longitude)),
          images: formData.images,
          coverImage,
          status: 'PENDING',
          softPublish: true,
          metadata: publishMeta,
          cancellationPolicy: formData.cancellationPolicy || 'moderate',
          instantBooking: formData.instantBooking === true,
          ...bookingDaysPayload,
        }),
      })
      const result = await res.json()
      if (result.success) {
        markWizardCleanForLeave?.()
        clearWizardDraft()
        toast.success(t('listingQuality_softPublishOk'), {
          description: t('listingQuality_softPublishOkHint'),
          duration: 10000,
        })
        router.push(resolvePostPublishCalendarOnboardingUrl(publishListingId))
      } else {
        const msg = result.error || t('partnerEdit_listingPublishErr')
        const extra = Array.isArray(result.errors) ? result.errors.join(' · ') : ''
        toast.error(msg, extra ? { description: extra, duration: 12000 } : undefined)
      }
    } catch (e) {
      console.error(e)
      toast.error(t('partnerEdit_listingPublishErr'))
    } finally {
      setPublishing(false)
    }
  }, [
    buildCoverUrl,
    draftListingIdRef,
    editId,
    formData,
    isEditMode,
    language,
    listingCategorySlug,
    listingCategoryWizardProfile,
    publishFromDraft,
    resolveListingIdForUpload,
    router,
    t,
    w,
    wizardMode,
  ])

  const saveDraft = useCallback(async () => {
    // Stage 201.64 — published edit still uses full patch; drafts (create or edit) are partial.
    if (wizardMode === 'edit' && isEditMode && !isWizardServerDraft(serverListing, formData)) {
      return savePatchForEdit()
    }
    setSavingDraft(true)
    try {
      const userId = await resolvePartnerUserId()
      if (!userId) {
        toast.error(t('pleaseLogIn'))
        return
      }

      // Never run provisional city / country gates for draft — partner may leave mid-wizard.
      const geoForm = formData
      const existingDraftId = String(editId || draftListingIdRef?.current || '').trim() || null
      if (!existingDraftId && !String(geoForm.categoryId || '').trim()) {
        toast.error(
          t('partnerWizard_selectCategoryBeforePhotos') ||
            'Сначала выберите категорию на шаге «Основное»',
        )
        return
      }

      const categorySlug = listingCategorySlug
      const tourCat =
        isTourListingCategory(categorySlug) ||
        normalizeCategoryWizardProfileColumn(listingCategoryWizardProfile) === 'tour'
      const bookingDaysPayload = tourCat
        ? { minBookingDays: 1, maxBookingDays: 730 }
        : {
            minBookingDays: parseInt(String(geoForm.minBookingDays), 10) || 1,
            maxBookingDays: parseInt(String(geoForm.maxBookingDays), 10) || 90,
          }
      const descTranslations = mergeDescriptionTranslationsForSave(geoForm, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...geoForm, metadata: { ...geoForm.metadata, description_translations: descTranslations } },
        language,
      )
      const draftMeta = normalizePartnerListingMetadata(
        { ...geoForm.metadata, description_translations: descTranslations, is_draft: true },
        categorySlug,
        geoForm.categoryName || '',
        listingCategoryWizardProfile,
      )
      const geoFields = optionalDraftGeoFields(geoForm)

      const leaveToPartnerListingsAfterDraftSave = (lid) => {
        markWizardCleanForLeave?.()
        clearWizardDraft()
        if (draftListingIdRef) draftListingIdRef.current = null
        toast.success(t('draftSaved'))
        void invalidatePartnerListingsCache(queryClient, listingsCacheOptsFromForm(lid, geoForm))
        router.push('/partner/listings')
        if (!lid) return
        void (async () => {
          try {
            const mig = await migrateExternalImagesAfterSave(lid, geoForm.images)
            if (mig?.images?.length) {
              const cover = mapCoverUrlAfterMigration(geoForm.images, geoForm.coverImage, mig.images)
              if (cover) await patchPartnerListingCoverImage(lid, cover)
            }
          } catch (e) {
            console.warn('[wizard] post-draft-save image migrate:', e)
          }
        })()
      }

      if (existingDraftId) {
        const payload = {
          title: geoForm.title || t('draftDefaultTitle'),
          description: descriptionDb,
          status: 'INACTIVE',
          available: false,
          basePriceThb: parseFloat(String(geoForm.basePriceThb)) || 0,
          baseCurrency: geoForm.baseCurrency || 'THB',
          images: geoForm.images || [],
          categoryId: geoForm.categoryId || undefined,
          metadata: draftMeta,
          instantBooking: geoForm.instantBooking === true,
          ...bookingDaysPayload,
          ...geoFields,
        }
        const res = await fetch(`/api/v2/partner/listings/${encodeURIComponent(existingDraftId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (data.success) {
          leaveToPartnerListingsAfterDraftSave(existingDraftId)
        } else {
          toast.error(data.error || t('failedToLoadListing'))
        }
      } else {
        const payload = {
          partnerId: userId,
          categoryId: geoForm.categoryId,
          title: geoForm.title || t('draftDefaultTitle'),
          description: descriptionDb,
          basePriceThb: (() => {
            const n = parseFloat(String(geoForm.basePriceThb ?? '').replace(',', '.'))
            return Number.isFinite(n) && n >= 0 ? n : 0
          })(),
          baseCurrency: geoForm.baseCurrency || 'THB',
          images: geoForm.images || [],
          metadata: draftMeta,
          instantBooking: geoForm.instantBooking === true,
          ...geoFields,
        }
        const res = await fetch('/api/v2/partner/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload),
        })
        const data = await res.json().catch(() => ({}))
        if (data.success) {
          leaveToPartnerListingsAfterDraftSave(data.data?.id || null)
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
    draftListingIdRef,
    editId,
    formData,
    isEditMode,
    language,
    listingCategorySlug,
    listingCategoryWizardProfile,
    markWizardCleanForLeave,
    queryClient,
    router,
    savePatchForEdit,
    serverListing,
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
    if (!assertInstantBookingGate({ formData, serverListing }, t)) return
    if (!assertPublishQualityGate(w, t)) return
    setLoading(true)
    try {
      const geoForm = await resolveFormDataWithProvisionalCity(formData, setFormData, t)
      if (!geoForm) return
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
            minBookingDays: parseInt(String(geoForm.minBookingDays), 10) || 1,
            maxBookingDays: parseInt(String(geoForm.maxBookingDays), 10) || 90,
          }
      const descTranslations = mergeDescriptionTranslationsForSave(geoForm, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...geoForm, metadata: { ...geoForm.metadata, description_translations: descTranslations } },
        language,
      )
      const publishMeta = normalizePartnerListingMetadata(
        { ...geoForm.metadata, description_translations: descTranslations, is_draft: false },
        categorySlug,
        geoForm.categoryName || '',
        listingCategoryWizardProfile,
      )
      const payload = {
        ...geoForm,
        description: descriptionDb,
        ownerId: userId,
        status: 'PENDING',
        available: true,
        basePriceThb: parseFloat(String(geoForm.basePriceThb)) || 0,
        baseCurrency: geoForm.baseCurrency || 'THB',
        commissionRate: Number.isFinite(parseFloat(String(geoForm.commissionRate)))
          ? parseFloat(String(geoForm.commissionRate))
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
          country: geoForm.country,
          region: geoForm.region,
          city: geoForm.city,
          district: payload.district,
          latitude:
            geoForm.latitude === '' || geoForm.latitude == null
              ? null
              : parseFloat(String(geoForm.latitude)),
          longitude:
            geoForm.longitude === '' || geoForm.longitude == null
              ? null
              : parseFloat(String(geoForm.longitude)),
          images: payload.images,
          coverImage: buildCoverUrl(),
          status: 'PENDING',
          softPublish: false,
          metadata: payload.metadata,
          cancellationPolicy: geoForm.cancellationPolicy || 'moderate',
          instantBooking: geoForm.instantBooking === true,
          ...bookingDaysPayload,
        }),
      })
      const data = await res.json()
      if (data.success) {
        const listingId = data.data?.id || data.listing?.id || publishListingId
        const mig = await migrateExternalImagesAfterSave(listingId, geoForm.images)
        if (mig?.images?.length) {
          const cover = mapCoverUrlAfterMigration(geoForm.images, geoForm.coverImage, mig.images)
          if (cover) await patchPartnerListingCoverImage(listingId, cover)
        }
        const seasons = geoForm.seasonalPricing || []
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
        markWizardCleanForLeave?.()
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
    setFormData,
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
    markWizardCleanForLeave,
  ])

  return {
    saveDraft,
    publishListing,
    softPublishListing,
    savePatchForEdit,
    patching,
    publishing,
  }
}
