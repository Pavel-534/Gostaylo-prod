'use client'

import { useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { clampIntFromDigits } from '@/lib/listing-wizard-numeric'
import {
  normalizeWizardAmenities,
  filterAmenitiesForPartnerCategory,
} from '@/lib/listing-wizard-amenities'
import { mergeAirbnbPreviewWizard } from '@/lib/partner/listing-import-merge'
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
import { guessIanaTimezoneFromLatLon } from '@/lib/geo/listing-timezone-guess'
import { ensureWizardDraftListing } from '@/lib/partner/ensure-wizard-draft-listing'
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
  } = state

  const { canProceed, WIZARD_DISTRICTS: districts } = derived

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

  const setCategoryId = useCallback(
    (value) => {
      const cat = categories.find((c) => c.id === value)
      const slug = String(cat?.slug || '').toLowerCase()
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
        return next
      })
    },
    [categories, setFormData],
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

  const resolveListingIdForUpload = useCallback(async () => {
    if (editId) return editId
    if (draftListingIdRef.current) return draftListingIdRef.current
    if (!formData.categoryId) {
      toast.error(
        t('partnerWizard_selectCategoryBeforePhotos') ||
          'Сначала выберите категорию на шаге «Основное»',
      )
      return null
    }
    if (ensuringDraftRef.current) return null
    ensuringDraftRef.current = true
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
        formData,
        draftTitleFallback: t('draftDefaultTitle'),
      })
      draftListingIdRef.current = listingId
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        if (!url.searchParams.get('edit')) {
          router.replace(`/partner/listings/new?edit=${encodeURIComponent(listingId)}`, { scroll: false })
        }
      }
      return listingId
    } catch (e) {
      console.error('[wizard] ensure draft listing for upload:', e)
      toast.error(
        e?.message === 'CATEGORY_REQUIRED'
          ? t('partnerWizard_selectCategoryBeforePhotos')
          : t('uploadFailedToast'),
      )
      return null
    } finally {
      ensuringDraftRef.current = false
    }
  }, [editId, formData, t, draftListingIdRef, ensuringDraftRef, router])

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
        return { ...prev, images: list.filter((_, i) => i !== index) }
      })
    },
    [editId, setFormData],
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
      const guessed = guessIanaTimezoneFromLatLon(r.lat, r.lon)
      setFormData((prev) => ({
        ...prev,
        latitude: r.lat,
        longitude: r.lon,
        metadata: {
          ...prev.metadata,
          ...(guessed ? { timezone: guessed } : {}),
        },
      }))
      setGeocodeResults([])
      setGeocodeQuery('')
    },
    [setFormData, setGeocodeResults, setGeocodeQuery],
  )

  const handleMapSelect = useCallback(
    (lat, lng, geo) => {
      const guessed = guessIanaTimezoneFromLatLon(lat, lng)
      setFormData((prev) => {
        const next = {
          ...prev,
          latitude: lat,
          longitude: lng,
          metadata: { ...prev.metadata, ...(guessed ? { timezone: guessed } : {}) },
        }
        if (geo?.district) {
          next.district = geo.district
        }
        if (geo?.city) {
          next.metadata = { ...next.metadata, city: geo.city }
        }
        return next
      })
      if (geo?.district) {
        setGeocodeQuery(geo.displayName || geo.district)
        setCustomDistricts((prev) =>
          prev.includes(geo.district) ? prev : [...prev, geo.district],
        )
      }
    },
    [setFormData, setGeocodeQuery, setCustomDistricts],
  )

  const applyAirbnbPreview = useCallback(
    (preview) => {
      setFormData((prev) => {
        const { nextFormData, customDistrictsToAdd } = mergeAirbnbPreviewWizard(prev, preview)
        const cat = categories.find((c) => c.id === prev.categoryId)
        const slug = String(cat?.slug || '').toLowerCase()
        const merged = {
          ...nextFormData,
          metadata: {
            ...nextFormData.metadata,
            amenities: filterAmenitiesForPartnerCategory(
              slug,
              normalizeWizardAmenities(nextFormData.metadata?.amenities || []),
            ),
          },
        }
        if (customDistrictsToAdd.length) {
          Promise.resolve().then(() => {
            setCustomDistricts((dprev) => {
              const n = [...dprev]
              for (const d of customDistrictsToAdd) {
                if (d && !districts.includes(d) && !n.includes(d)) n.push(d)
              }
              return n
            })
          })
        }
        return merged
      })
    },
    [categories, setFormData, setCustomDistricts, districts],
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
    resolveListingIdForUpload,
    handleImageUpload,
    removeImage,
    handleGeocode,
    selectGeocodeResult,
    handleMapSelect,
    applyAirbnbPreview,
  }
}
