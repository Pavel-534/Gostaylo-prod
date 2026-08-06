'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { clampIntFromDigits } from '@/lib/listing-wizard-numeric'
import {
  normalizeWizardAmenities,
  filterAmenitiesForPartnerCategory,
} from '@/lib/listing-wizard-amenities'
import { isTourListingCategory } from '@/lib/listing-category-slug'
import {
  normalizeCategoryWizardProfileColumn,
  isTransportWizardCategory,
} from '@/lib/config/category-wizard-profile-db'
import {
  categorySlugMatchesListingServiceType,
  defaultMetadataForListingServiceType,
} from '@/lib/partner/listing-service-type'
import { applyDurationDiscountField } from '@/lib/partner/duration-discount-helpers'
import { mergeWizardFormGeoFromPin } from '@/lib/geo/wizard-geo-from-pin'
import {
  ensureWizardDraftListing,
  shouldCreateWizardDraftOnCategory,
} from '@/lib/partner/ensure-wizard-draft-listing'
import { saveWizardDraft } from '@/lib/partner/wizard-draft-storage'
import { buildWizardFormDataFromListing } from './listing-wizard-load-existing'
import { LISTING_WIZARD_STEP_COUNT } from '../wizard-constants'

/**
 * Stage 109.3 — wizard mutations (form, steps, upload, geo, AI, import).
 */
export function useListingWizardActions(state, derived) {
  const router = useRouter()
  const {
    editId,
    isEditMode,
    language,
    authLoading,
    isAuthenticated,
    t,
    currentStep,
    setCurrentStep,
    setLoading,
    setServerListing,
    setListingNotFound,
    setUploading,
    setUploadProgress,
    setGeocoding,
    setAiDescriptionLoading,
    aiDescQuota,
    setAiDescQuota,
    geocodeQuery,
    setGeocodeQuery,
    setGeocodeResults,
    setCustomDistricts,
    categories,
    partnerCommissionRate,
    formData,
    setFormData,
    fileInputRef,
    draftListingIdRef,
    ensuringDraftRef,
    serverListing,
  } = state

  const { canProceed, WIZARD_DISTRICTS: districts } = derived
  const baseCurrencyLocked =
    serverListing?.financialLock?.baseCurrencyLocked === true ||
    serverListing?.financialLock?.locked === true

  const refreshAiDescriptionQuota = useCallback(async () => {
    try {
      const qs = isEditMode && editId ? `listingId=${encodeURIComponent(editId)}` : ''
      const res = await fetch(`/api/v2/partner/listings/generate-description?${qs}`, {
        credentials: 'include',
      })
      const j = await res.json()
      if (j.success && j.data) setAiDescQuota(j.data)
    } catch {
      /* ignore */
    }
  }, [isEditMode, editId, setAiDescQuota])

  useEffect(() => {
    if (currentStep === 1) refreshAiDescriptionQuota()
  }, [currentStep, isEditMode, editId, refreshAiDescriptionQuota])

  const updateField = useCallback(
    (field, value) => {
      setFormData((prev) => ({ ...prev, [field]: value }))
    },
    [setFormData],
  )

  const updateDescription = useCallback(
    (value) => {
      setFormData((prev) => {
        const meta = { ...prev.metadata }
        const dt = {
          ...(meta.description_translations && typeof meta.description_translations === 'object'
            ? meta.description_translations
            : {}),
        }
        if (language === 'ru') dt.ru = value
        else if (language === 'en') dt.en = value
        else if (language === 'zh') dt.zh = value
        else if (language === 'th') dt.th = value
        return {
          ...prev,
          description: value,
          metadata: { ...meta, description_translations: dt },
        }
      })
    },
    [language, setFormData],
  )

  const updateMetadata = useCallback(
    (field, value) => {
      setFormData((prev) => ({
        ...prev,
        metadata: { ...prev.metadata, [field]: value },
      }))
    },
    [setFormData],
  )

  const updateDurationDiscountPercent = useCallback(
    (field, raw) => {
      setFormData((fd) => {
        const meta = fd.metadata && typeof fd.metadata === 'object' ? { ...fd.metadata } : {}
        const { metadata, warnOrder } = applyDurationDiscountField(meta, field, raw)
        if (warnOrder) {
          queueMicrotask(() => toast.warning(t('partnerDurationDiscountOrderWarning')))
        }
        return { ...fd, metadata }
      })
    },
    [t, setFormData],
  )

  const goNext = useCallback(() => {
    if (canProceed && currentStep < LISTING_WIZARD_STEP_COUNT) {
      setCurrentStep((p) => p + 1)
    }
  }, [canProceed, currentStep, setCurrentStep])

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((p) => p - 1)
    }
  }, [currentStep, setCurrentStep])

  const setListingServiceType = useCallback(
    (type) => {
      setFormData((prev) => {
        const catRow = categories.find((c) => c.id === prev.categoryId)
        const slug = catRow?.slug
        const keepCategory = Boolean(
          slug &&
            categorySlugMatchesListingServiceType(
              String(slug),
              String(type),
              catRow?.wizardProfile ?? catRow?.wizard_profile,
            ),
        )
        const meta = defaultMetadataForListingServiceType(String(type), prev.metadata)
        return {
          ...prev,
          listingServiceType: type,
          categoryId: keepCategory ? prev.categoryId : '',
          categoryName: keepCategory ? prev.categoryName : '',
          metadata: meta,
        }
      })
    },
    [categories, setFormData],
  )

  const resolveOrCreateWizardDraft = useCallback(
    async (formSnapshot, { silentCategoryToast = false, updateUrl = true } = {}) => {
      if (editId) return editId
      if (draftListingIdRef.current) return draftListingIdRef.current
      if (!formSnapshot?.categoryId) {
        if (!silentCategoryToast) {
          toast.error(
            t('partnerWizard_selectCategoryBeforePhotos') ||
              'Сначала выберите категорию на шаге «Основное»',
          )
        }
        return null
      }
      if (ensuringDraftRef.current) {
        return ensuringDraftRef.current
      }
      ensuringDraftRef.current = (async () => {
        try {
          const meRes = await fetch('/api/v2/auth/me', { credentials: 'include' })
          const meData = await meRes.json()
          const partnerId = meData?.user?.id
          if (!partnerId) {
            toast.error(t('pleaseLogIn'))
            return null
          }
          const listingId = await ensureWizardDraftListing({
            partnerId,
            formData: formSnapshot,
            draftTitleFallback: t('draftDefaultTitle'),
          })
          draftListingIdRef.current = listingId
          try {
            saveWizardDraft(formSnapshot, currentStep, listingId)
          } catch {
            /* ignore */
          }
          // URL ?edit= switches create→edit and reloads server row (wipes in-progress form).
          // Category-select drafts keep id in ref only; photo/publish may set URL.
          if (updateUrl && typeof window !== 'undefined') {
            const url = new URL(window.location.href)
            if (!url.searchParams.get('edit')) {
              router.replace(`/partner/listings/new?edit=${encodeURIComponent(listingId)}`, {
                scroll: false,
              })
            }
          }
          return listingId
        } catch (e) {
          console.error('[wizard] ensure draft listing:', e)
          toast.error(
            e?.message === 'CATEGORY_REQUIRED'
              ? t('partnerWizard_selectCategoryBeforePhotos')
              : t('uploadFailedToast'),
          )
          return null
        } finally {
          ensuringDraftRef.current = null
        }
      })()
      return ensuringDraftRef.current
    },
    [editId, t, draftListingIdRef, ensuringDraftRef, router, currentStep],
  )

  const setCategoryId = useCallback(
    (value) => {
      const cat = categories.find((c) => c.id === value)
      const slug = String(cat?.slug || '').toLowerCase()
      /** @type {object | null} */
      let snapshotForDraft = null
      setFormData((prev) => {
        const baseMeta = { ...prev.metadata }
        const amenityFiltered = filterAmenitiesForPartnerCategory(
          slug,
          Array.isArray(baseMeta.amenities) ? baseMeta.amenities : [],
        )
        const next = { ...prev, categoryId: value, categoryName: cat?.name || '' }
        if (isTransportWizardCategory(slug, cat?.wizardProfile ?? cat?.wizard_profile)) {
          next.metadata = {
            ...baseMeta,
            bedrooms: 0,
            bathrooms: 0,
            max_guests: 2,
            area: 0,
            amenities: amenityFiltered,
            property_type: '',
          }
        } else if (
          isTourListingCategory(slug) ||
          normalizeCategoryWizardProfileColumn(cat?.wizardProfile ?? cat?.wizard_profile) === 'tour'
        ) {
          const { discounts: _d, ...restMeta } = baseMeta
          const gmin =
            restMeta.group_size_min != null && restMeta.group_size_min !== ''
              ? clampIntFromDigits(restMeta.group_size_min, 1, 999, 1)
              : 1
          let gmax =
            restMeta.group_size_max != null && restMeta.group_size_max !== ''
              ? clampIntFromDigits(restMeta.group_size_max, 1, 999, Math.max(gmin, 10))
              : Math.max(gmin, 10)
          if (gmax < gmin) gmax = gmin
          next.minBookingDays = 1
          next.maxBookingDays = 730
          next.metadata = {
            ...restMeta,
            group_size_min: gmin,
            group_size_max: gmax,
            amenities: filterAmenitiesForPartnerCategory(slug, baseMeta.amenities || []),
          }
        } else {
          next.metadata = {
            ...baseMeta,
            amenities: filterAmenitiesForPartnerCategory(slug, baseMeta.amenities || []),
          }
        }
        snapshotForDraft = next
        return next
      })

      // Stage 200.20 — draft right after category (create mode only).
      const existingId = editId || draftListingIdRef.current
      if (
        shouldCreateWizardDraftOnCategory({
          existingListingId: existingId,
          categoryId: value,
        }) &&
        snapshotForDraft
      ) {
        void resolveOrCreateWizardDraft(snapshotForDraft, {
          silentCategoryToast: true,
          updateUrl: false,
        })
      } else if (value && draftListingIdRef.current && !editId) {
        // Category switch on an existing create-mode draft — keep row in sync.
        void fetch(`/api/v2/partner/listings/${encodeURIComponent(draftListingIdRef.current)}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoryId: value,
            metadata: {
              ...(snapshotForDraft?.metadata && typeof snapshotForDraft.metadata === 'object'
                ? snapshotForDraft.metadata
                : {}),
              is_draft: true,
              wizard_upload: true,
            },
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}))
              toast.error(data.error || t('partnerWizard_categoryUpdateFailed'))
            }
          })
          .catch((e) => {
            console.error('[wizard] patch draft category:', e)
            toast.error(t('partnerWizard_categoryUpdateFailed'))
          })
      }
    },
    [categories, setFormData, editId, draftListingIdRef, resolveOrCreateWizardDraft, t],
  )

  const loadExistingListing = useCallback(
    async (listingId) => {
      try {
        setLoading(true)
        setListingNotFound(false)
        const res = await fetch(`/api/v2/partner/listings/${listingId}`, { credentials: 'include' })
        const data = await res.json()
        const listing = data.data || data.listing
        if (data.success && listing) {
          const built = buildWizardFormDataFromListing(listing, {
            language,
            partnerCommissionRate,
            t,
          })
          setFormData(built.formData)
          setServerListing(built.serverListing)
        } else {
          setServerListing(null)
          setListingNotFound(true)
        }
      } catch (error) {
        console.error('Failed to load listing:', error)
        setServerListing(null)
        setListingNotFound(true)
        toast.error(t('failedToLoadListing'))
      } finally {
        setLoading(false)
      }
    },
    [
      language,
      partnerCommissionRate,
      t,
      setFormData,
      setLoading,
      setListingNotFound,
      setServerListing,
    ],
  )

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) return
    if (!isEditMode || !editId) return
    loadExistingListing(editId)
  }, [authLoading, isAuthenticated, isEditMode, editId, loadExistingListing])

  const handleAiImproveDescription = useCallback(async () => {
    if (!formData.title || formData.title.trim().length < 10) {
      toast.error(t('improveDescriptionTitleMin'))
      return
    }
    if (aiDescQuota.exhausted) return
    setAiDescriptionLoading(true)
    try {
      const res = await fetch('/api/v2/partner/listings/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listingId: isEditMode && editId ? editId : undefined,
          title: formData.title.trim(),
          district: formData.district || '',
          categorySlug: categories.find((c) => c.id === formData.categoryId)?.slug || '',
          basePriceThb: formData.basePriceThb,
          baseCurrency: formData.baseCurrency || 'THB',
          metadata: formData.metadata,
          existingDescription: formData.description || '',
          mode: 'generate',
        }),
      })
      const data = await res.json()
      if (res.status === 429 || data.error === 'QUOTA_EXHAUSTED') {
        setAiDescQuota((q) => ({ ...q, exhausted: true, remaining: 0 }))
        toast.error(t('improveDescriptionAILimitExhausted'))
        return
      }
      if (!res.ok || !data.success) {
        toast.error(data.error || t('failedToLoadListing'))
        return
      }
      const dr = String(data.data?.descriptionRu || '').slice(0, 2000)
      const enS = String(data.data?.descriptionEn || '').slice(0, 2000)
      const zhS = String(data.data?.descriptionZh || '').slice(0, 2000)
      const thS = String(data.data?.descriptionTh || '').slice(0, 2000)
      const seo = data.data?.seo || {}
      const byLang = { ru: dr, en: enS, zh: zhS, th: thS }
      const shown = (byLang[language] || enS || dr).slice(0, 2000)
      if (data.data?.quota) setAiDescQuota(data.data.quota)
      setFormData((prev) => {
        const meta = { ...prev.metadata }
        const prevSeo = meta.seo && typeof meta.seo === 'object' ? meta.seo : {}
        return {
          ...prev,
          description: shown,
          metadata: {
            ...meta,
            description_translations: { ru: dr, en: enS, zh: zhS, th: thS },
            seo: {
              ...prevSeo,
              ...(seo.ru ? { ru: seo.ru } : {}),
              ...(seo.en ? { en: seo.en } : {}),
              ...(seo.zh ? { zh: seo.zh } : {}),
              ...(seo.th ? { th: seo.th } : {}),
            },
          },
        }
      })
      toast.success(t('improveDescriptionSeoSuccess'))
    } catch (e) {
      console.error(e)
      toast.error(t('failedToLoadListing'))
    } finally {
      setAiDescriptionLoading(false)
    }
  }, [
    aiDescQuota.exhausted,
    categories,
    formData,
    isEditMode,
    editId,
    language,
    t,
    setAiDescriptionLoading,
    setAiDescQuota,
    setFormData,
  ])

  const handleAiTranslateDescription = useCallback(async () => {
    const source = String(formData.description || '').trim()
    if (source.length < 40) {
      toast.error(t('translateDescriptionMinLength'))
      return
    }
    if (!formData.title || formData.title.trim().length < 3) {
      toast.error(t('improveDescriptionTitleMin'))
      return
    }
    if (aiDescQuota.exhausted) return
    setAiDescriptionLoading(true)
    try {
      const res = await fetch('/api/v2/partner/listings/generate-description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          listingId: isEditMode && editId ? editId : undefined,
          title: formData.title.trim(),
          district: formData.district || '',
          categorySlug: categories.find((c) => c.id === formData.categoryId)?.slug || '',
          basePriceThb: formData.basePriceThb,
          baseCurrency: formData.baseCurrency || 'THB',
          metadata: formData.metadata,
          existingDescription: source,
          mode: 'translate',
        }),
      })
      const data = await res.json()
      if (res.status === 429 || data.error === 'QUOTA_EXHAUSTED') {
        setAiDescQuota((q) => ({ ...q, exhausted: true, remaining: 0 }))
        toast.error(t('improveDescriptionAILimitExhausted'))
        return
      }
      if (!res.ok || !data.success) {
        toast.error(
          data.code === 'TRANSLATE_SOURCE_TOO_SHORT'
            ? t('translateDescriptionMinLength')
            : data.error || t('failedToLoadListing'),
        )
        return
      }
      const dr = String(data.data?.descriptionRu || '').slice(0, 2000)
      const enS = String(data.data?.descriptionEn || '').slice(0, 2000)
      const zhS = String(data.data?.descriptionZh || '').slice(0, 2000)
      const thS = String(data.data?.descriptionTh || '').slice(0, 2000)
      const seo = data.data?.seo || {}
      const byLang = { ru: dr, en: enS, zh: zhS, th: thS }
      const shown = (byLang[language] || source || enS || dr).slice(0, 2000)
      if (data.data?.quota) setAiDescQuota(data.data.quota)
      setFormData((prev) => {
        const meta = { ...prev.metadata }
        const prevSeo = meta.seo && typeof meta.seo === 'object' ? meta.seo : {}
        return {
          ...prev,
          description: shown,
          metadata: {
            ...meta,
            description_translations: { ru: dr, en: enS, zh: zhS, th: thS },
            seo: {
              ...prevSeo,
              ...(seo.ru ? { ru: seo.ru } : {}),
              ...(seo.en ? { en: seo.en } : {}),
              ...(seo.zh ? { zh: seo.zh } : {}),
              ...(seo.th ? { th: seo.th } : {}),
            },
          },
        }
      })
      toast.success(t('translateDescriptionSuccess'))
    } catch (e) {
      console.error(e)
      toast.error(t('failedToLoadListing'))
    } finally {
      setAiDescriptionLoading(false)
    }
  }, [
    aiDescQuota.exhausted,
    categories,
    formData,
    isEditMode,
    editId,
    language,
    t,
    setAiDescriptionLoading,
    setAiDescQuota,
    setFormData,
  ])

  const resolveListingIdForUpload = useCallback(async () => {
    return resolveOrCreateWizardDraft(formData)
  }, [formData, resolveOrCreateWizardDraft])

  const handleImageUpload = useCallback(
    async (files) => {
      const fileList = Array.from(files || []).filter((f) => f.type?.startsWith('image/'))
      if (fileList.length === 0) return
      setUploading(true)
      setUploadProgress(0)
      const folderId = await resolveListingIdForUpload()
      if (!folderId) {
        setUploading(false)
        return
      }
      try {
        const { processAndUploadImages } = await import('@/lib/services/image-upload.service')
        const uploadedUrls = await processAndUploadImages(fileList, folderId, (p) =>
          setUploadProgress(p),
        )
        if (uploadedUrls.length > 0) {
          setFormData((prev) => ({ ...prev, images: [...(prev.images || []), ...uploadedUrls] }))
          toast.success(`+${uploadedUrls.length} ${t('photosUploadedToast')}`)
        }
        if (uploadedUrls.length < fileList.length) {
          toast.error(t('uploadFailedToast'))
        }
      } catch (e) {
        console.error(e)
        toast.error(t('uploadFailedToast'))
      } finally {
        setUploading(false)
        setUploadProgress(0)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [resolveListingIdForUpload, t, setUploading, setUploadProgress, setFormData, fileInputRef],
  )

  const removeImage = useCallback(
    (index) => {
      setFormData((prev) => {
        const list = prev.images || []
        const imageUrl = list[index]
        if (
          editId &&
          typeof imageUrl === 'string' &&
          (imageUrl.includes('/listing-images/') || imageUrl.includes('supabase.co/storage'))
        ) {
          queueMicrotask(async () => {
            try {
              const { deleteFromStorage } = await import('@/lib/services/image-upload.service')
              await deleteFromStorage(imageUrl)
            } catch (e) {
              console.warn('removeImage: storage delete', e)
            }
          })
        }
        const next = list.filter((_, i) => i !== index)
        return { ...prev, images: next, coverImage: next[0] || '' }
      })
    },
    [editId, setFormData],
  )

  const reorderImages = useCallback(
    (fromIndex, toIndex) => {
      setFormData((prev) => {
        const list = [...(prev.images || [])]
        if (
          fromIndex < 0 ||
          toIndex < 0 ||
          fromIndex >= list.length ||
          toIndex >= list.length ||
          fromIndex === toIndex
        ) {
          return prev
        }
        const [moved] = list.splice(fromIndex, 1)
        list.splice(toIndex, 0, moved)
        return { ...prev, images: list, coverImage: list[0] || '' }
      })
    },
    [setFormData],
  )

  const handleGeocode = useCallback(async () => {
    if (!geocodeQuery.trim() || geocodeQuery.length < 3) return
    setGeocoding(true)
    setGeocodeResults([])
    try {
      const res = await fetch(`/api/v2/geocode?q=${encodeURIComponent(geocodeQuery.trim())}`)
      const data = await res.json()
      if (data.success && data.data?.length) {
        setGeocodeResults(data.data)
      } else {
        toast.error(t('geocodeNoResults'))
      }
    } catch {
      toast.error(t('geocodeSearchFailed'))
    } finally {
      setGeocoding(false)
    }
  }, [geocodeQuery, t, setGeocoding, setGeocodeResults])

  const selectGeocodeResult = useCallback(
    (r) => {
      const addr = r?.address && typeof r.address === 'object' ? r.address : null
      setFormData((prev) =>
        mergeWizardFormGeoFromPin(prev, {
          lat: r.lat,
          lon: r.lon,
          baseCurrencyLocked,
          geo: {
            displayName: r.displayName,
            countryCode: addr?.country_code || null,
            country: addr?.country || null,
            city: addr?.city || addr?.town || addr?.municipality || null,
            state: addr?.state || null,
            district: addr?.suburb || addr?.neighbourhood || null,
            address: addr,
            regionCode: r.regionCode || null,
            cityCode: r.cityCode || null,
            cityTimezone: r.timezone || null,
          },
        }),
      )
      setGeocodeResults([])
      setGeocodeQuery('')
    },
    [setFormData, setGeocodeResults, setGeocodeQuery, baseCurrencyLocked],
  )

  const handleMapSelect = useCallback(
    (lat, lng, geo) => {
      setFormData((prev) =>
        mergeWizardFormGeoFromPin(prev, {
          lat,
          lon: lng,
          geo,
          baseCurrencyLocked,
        }),
      )
      const dist = geo?.district
      if (dist) {
        setGeocodeQuery(geo.displayName || dist)
        setCustomDistricts((prev) => (prev.includes(dist) ? prev : [...prev, dist]))
      } else if (geo?.displayName) {
        setGeocodeQuery(geo.displayName)
      }
    },
    [setFormData, setGeocodeQuery, setCustomDistricts, baseCurrencyLocked],
  )

  return {
    refreshAiDescriptionQuota,
    updateField,
    updateDescription,
    updateMetadata,
    updateDurationDiscountPercent,
    goNext,
    goBack,
    setListingServiceType,
    setCategoryId,
    handleAiImproveDescription,
    handleAiTranslateDescription,
    resolveListingIdForUpload,
    handleImageUpload,
    removeImage,
    reorderImages,
    handleGeocode,
    selectGeocodeResult,
    handleMapSelect,
  }
}
