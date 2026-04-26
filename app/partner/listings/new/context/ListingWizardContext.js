'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText, getCategoryName, getAmenityName } from '@/lib/translations'
import { clampIntFromDigits, sanitizeThbDigits } from '@/lib/listing-wizard-numeric'
import {
  normalizeWizardAmenities,
  amenitySlugsForPartnerCategory,
  filterAmenitiesForPartnerCategory,
} from '@/lib/listing-wizard-amenities'
import { toast } from 'sonner'
import { mergeAirbnbPreviewWizard } from '@/lib/partner/listing-import-merge'
import {
  normalizePartnerListingMetadata,
  partnerMetadataStateFromServer,
  mergeTourGroupMetadataFromListingColumns,
  isPartnerListingHousingCategory,
} from '@/lib/partner/listing-wizard-metadata'
import { isTransportListingCategory, isTourListingCategory } from '@/lib/listing-category-slug'
import {
  categorySlugMatchesListingServiceType,
  defaultMetadataForListingServiceType,
  inferListingServiceTypeFromCategorySlug,
} from '@/lib/partner/listing-service-type'
import { pickPartnerFormDescription } from '@/lib/partner/listing-description-i18n'
import { applyDurationDiscountField } from '@/lib/partner/duration-discount-helpers'
import { guessIanaTimezoneFromLatLon } from '@/lib/geo/listing-timezone-guess'
import { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'
import { WIZARD_DISTRICTS, getDefaultWizardFormData } from '../wizard-constants'
import { ru, enUS, zhCN, th as thDateLocale } from 'date-fns/locale'

const ListingWizardContext = createContext(null)

export { WIZARD_DISTRICTS }

/**
 * Wizard: (1) general+specs (2) location (3) photos (4) pricing (5) preview.
 * Form data persists across steps.
 * @param {{ children: React.ReactNode, initialListingId?: string | null, mode?: 'create' | 'edit' }} props
 */
export function ListingWizardProvider({ children, initialListingId = null, mode: wizardMode = 'create' }) {
  const searchParams = useSearchParams()
  const editId = initialListingId || searchParams.get('edit') || null
  const isEditMode = Boolean(editId)

  const { language } = useI18n()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const t = useCallback((key) => getUIText(key, language), [language])
  const tr = useCallback(
    (key, vars) => {
      let s = getUIText(key, language)
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.split(`{{${k}}}`).join(String(v))
        }
      }
      return s
    },
    [language],
  )
  const numberLocale = useMemo(
    () => ({ ru: 'ru-RU', en: 'en-US', zh: 'zh-CN', th: 'th-TH' }[language] || 'en-US'),
    [language],
  )
  const dayPickerLocale = { ru, en: enUS, zh: zhCN, th: thDateLocale }[language] || ru

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [serverListing, setServerListing] = useState(null)
  const [listingNotFound, setListingNotFound] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [geocoding, setGeocoding] = useState(false)
  const [aiDescriptionLoading, setAiDescriptionLoading] = useState(false)
  const [aiDescQuota, setAiDescQuota] = useState({ used: 0, limit: 3, remaining: 3, exhausted: false })
  const [geocodeQuery, setGeocodeQuery] = useState('')
  const [geocodeResults, setGeocodeResults] = useState([])
  const [customDistricts, setCustomDistricts] = useState([])
  const [categories, setCategories] = useState([])
  const [newSeason, setNewSeason] = useState({
    label: '',
    dateRange: { from: null, to: null },
    priceDaily: '',
    priceMonthly: '',
    seasonType: 'NORMAL',
  })
  const [partnerCommissionRate, setPartnerCommissionRate] = useState(null)
  const [pricingPolicy, setPricingPolicy] = useState({
    guestServiceFeePercent: PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent,
    hostCommissionPercent: PLATFORM_SPLIT_FEE_DEFAULTS.hostCommissionPercentFromGeneral,
    insuranceFundPercent: PLATFORM_SPLIT_FEE_DEFAULTS.insuranceFundPercent,
    chatInvoiceRateMultiplier: 1.025,
  })
  const [formData, setFormData] = useState(getDefaultWizardFormData)

  const fileInputRef = useRef(null)
  const uploadFolderRef = useRef(null)

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

  const wizardCategoriesForSelect = useMemo(() => {
    const st = formData.listingServiceType
    if (!st) return []
    return categories.filter((c) => categorySlugMatchesListingServiceType(c.slug, st))
  }, [categories, formData.listingServiceType])
  const transportWizard = isTransportListingCategory(listingCategorySlug)
  const toursWizard = isTourListingCategory(listingCategorySlug)
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

  /** Step validation: 1 general+specs; 2 location; 3 photos; 4 pricing; 5 preview. */
  const canProceed = useMemo(() => {
    const generalOk =
      Boolean(formData.listingServiceType) &&
      formData.categoryId &&
      formData.title.length >= 10 &&
      formData.description.length >= 20
    const locOk = Boolean(formData.district) && coordsValid
    const photosOk = (formData.images || []).length >= 1
    const priceOk = parseFloat(String(formData.basePriceThb).replace(',', '.')) > 0

    switch (currentStep) {
      case 1:
        return generalOk
      case 2:
        return locOk
      case 3:
        return photosOk
      case 4:
        return priceOk
      case 5:
        return generalOk && locOk && photosOk && priceOk
      default:
        return false
    }
  }, [currentStep, formData, coordsValid])

  const pricingPreview = useMemo(() => {
    const base = Math.round(Number(formData.basePriceThb) || 0)
    const guestFeePercent = Number(pricingPolicy.guestServiceFeePercent) || 0
    const guestFeeThb = Math.round(base * (guestFeePercent / 100))
    const sitePriceSameCurrency = base + guestFeeThb
    const markupMultiplier = Math.max(1, Number(pricingPolicy.chatInvoiceRateMultiplier) || 1)
    const sitePriceCrossCurrency = Math.round(sitePriceSameCurrency * markupMultiplier)
    return {
      base,
      guestFeePercent,
      guestFeeThb,
      sitePriceSameCurrency,
      markupPercent: Math.max(0, (markupMultiplier - 1) * 100),
      sitePriceCrossCurrency,
    }
  }, [formData.basePriceThb, pricingPolicy.guestServiceFeePercent, pricingPolicy.chatInvoiceRateMultiplier])

  const progress = useMemo(() => ((currentStep - 1) / 4) * 100, [currentStep])

  useEffect(() => {
    async function loadInitialData() {
      try {
        const catRes = await fetch('/api/v2/categories')
        const catData = await catRes.json()
        if (catData.success) {
          setCategories(catData.data || [])
        }
        let userId = localStorage.getItem('gostaylo_user_id')
        if (!userId) {
          const meRes = await fetch('/api/v2/auth/me', { credentials: 'include' })
          const meData = await meRes.json()
          if (meData.success && meData.user?.id) {
            userId = String(meData.user.id)
            localStorage.setItem('gostaylo_user_id', userId)
          }
        }
        if (userId) {
          const commissionRes = await fetch(`/api/v2/commission?partnerId=${userId}`, { credentials: 'include' })
          const commissionData = await commissionRes.json()
          if (commissionData.success && commissionData.data) {
            const rate = commissionData.data.effectiveRate ?? commissionData.data.systemRate
            if (rate != null && Number.isFinite(Number(rate))) {
              const n = Number(rate)
              setPartnerCommissionRate(n)
              setFormData((prev) => ({ ...prev, commissionRate: n }))
            }
            setPricingPolicy((prev) => ({
              ...prev,
              guestServiceFeePercent: Number.isFinite(Number(commissionData.data.guestServiceFeePercent))
                ? Number(commissionData.data.guestServiceFeePercent)
                : prev.guestServiceFeePercent,
              hostCommissionPercent: Number.isFinite(Number(commissionData.data.hostCommissionPercent))
                ? Number(commissionData.data.hostCommissionPercent)
                : Number(rate),
              insuranceFundPercent: Number.isFinite(Number(commissionData.data.insuranceFundPercent))
                ? Number(commissionData.data.insuranceFundPercent)
                : prev.insuranceFundPercent,
              chatInvoiceRateMultiplier: Number.isFinite(Number(commissionData.data.chatInvoiceRateMultiplier))
                ? Number(commissionData.data.chatInvoiceRateMultiplier)
                : prev.chatInvoiceRateMultiplier,
            }))
          }
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
      }
    }
    loadInitialData()
  }, [])

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
  }, [isEditMode, editId])

  useEffect(() => {
    if (currentStep === 1) refreshAiDescriptionQuota()
  }, [currentStep, isEditMode, editId, refreshAiDescriptionQuota])

  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }, [])

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
    [language],
  )

  const updateMetadata = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value },
    }))
  }, [])

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
    [t],
  )

  const goNext = useCallback(() => {
    if (canProceed && currentStep < 5) {
      setCurrentStep((p) => p + 1)
    }
  }, [canProceed, currentStep])

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((p) => p - 1)
    }
  }, [currentStep])

  const setListingServiceType = useCallback((type) => {
    setFormData((prev) => {
      const slug = categories.find((c) => c.id === prev.categoryId)?.slug
      const keepCategory = Boolean(
        slug && categorySlugMatchesListingServiceType(String(slug), String(type)),
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
  }, [categories])

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
        if (isTransportListingCategory(slug)) {
          next.metadata = {
            ...baseMeta,
            bedrooms: 0,
            bathrooms: 0,
            max_guests: 2,
            area: 0,
            amenities: amenityFiltered,
            property_type: '',
          }
        } else if (isTourListingCategory(slug)) {
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
          next.metadata = { ...baseMeta, amenities: filterAmenitiesForPartnerCategory(slug, baseMeta.amenities || []) }
        }
        return next
      })
    },
    [categories],
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
          const c = listing.category || listing.categories
          const rawSeasonal = listing.seasonalPricing || listing.seasonalPrices || []
          const seasonal = rawSeasonal.map((s, i) => ({
            id: s.id || `s-${i}`,
            label: s.label || t('defaultListingSeasonLabel'),
            startDate: s.startDate || s.start_date,
            endDate: s.endDate || s.end_date,
            priceDaily: s.priceDaily ?? s.price_daily ?? 0,
            priceMonthly: s.priceMonthly ?? s.price_monthly ?? null,
            seasonType: s.seasonType || s.season_type || 'high',
          }))
          const rawMeta = listing.metadata || {}
          const shapedMeta = partnerMetadataStateFromServer(rawMeta)
          const catSlug = c?.slug || ''
          const tourCat = isTourListingCategory(catSlug)
          const metaForForm = tourCat
            ? mergeTourGroupMetadataFromListingColumns(
                shapedMeta,
                listing.minBookingDays ?? listing.min_booking_days,
                listing.maxBookingDays ?? listing.max_booking_days,
              )
            : shapedMeta
          const listingDesc = listing.description || ''
          const coverU = listing.coverImage || listing.cover_image
          const rawImgs = Array.isArray(listing.images) ? [...listing.images] : []
          let imagesOrdered = rawImgs
          if (coverU) {
            const idx = imagesOrdered.findIndex((u) => u === coverU)
            if (idx > 0) {
              const copy = [...imagesOrdered]
              const [first] = copy.splice(idx, 1)
              imagesOrdered = [first, ...copy]
            } else if (idx === -1) {
              imagesOrdered = [coverU, ...rawImgs]
            }
          }
          const inferredServiceType = inferListingServiceTypeFromCategorySlug(catSlug)
          setFormData({
            ...getDefaultWizardFormData(),
            listingServiceType: inferredServiceType,
            categoryId: listing.categoryId || listing.category_id || '',
            categoryName: c?.name || '',
            title: listing.title || '',
            description: pickPartnerFormDescription(language, listingDesc, rawMeta),
            district: listing.district || '',
            latitude: listing.latitude ?? null,
            longitude: listing.longitude ?? null,
            basePriceThb:
              sanitizeThbDigits((listing.basePriceThb ?? listing.base_price_thb)?.toString() || '') || '',
            baseCurrency:
              listing.baseCurrency || listing.base_currency || listing.metadata?.base_currency || 'THB',
            commissionRate: listing.commissionRate ?? listing.commission_rate ?? partnerCommissionRate,
            minBookingDays: tourCat
              ? 1
              : clampIntFromDigits(listing.minBookingDays ?? listing.min_booking_days ?? 1, 1, 365, 1),
            maxBookingDays: tourCat
              ? 730
              : clampIntFromDigits(listing.maxBookingDays ?? listing.max_booking_days ?? 90, 1, 730, 90),
            images: imagesOrdered,
            coverImage: coverU || imagesOrdered[0] || '',
            cancellationPolicy: listing.cancellationPolicy || listing.cancellation_policy || 'moderate',
            status: listing.status,
            available: Boolean(listing.available),
            metadata: {
              ...getDefaultWizardFormData().metadata,
              ...metaForForm,
              bedrooms: clampIntFromDigits(metaForForm.bedrooms ?? 0, 0, 99, 0),
              bathrooms: clampIntFromDigits(metaForForm.bathrooms ?? 0, 0, 99, 0),
              max_guests: clampIntFromDigits(metaForForm.max_guests ?? 2, 1, 999, 1),
              area: clampIntFromDigits(metaForForm.area ?? 0, 0, 9_999_999, 0),
              passengers: clampIntFromDigits(metaForForm.passengers ?? rawMeta.passengers ?? 0, 0, 999, 0),
              amenities: filterAmenitiesForPartnerCategory(
                c?.slug || '',
                normalizeWizardAmenities(rawMeta.amenities || []),
              ),
              languages: Array.isArray(metaForForm.languages) ? metaForForm.languages : [],
              experience_years: metaForForm.experience_years ?? '',
              transmission: metaForForm.transmission ?? '',
              fuel_type: metaForForm.fuel_type ?? '',
              engine_cc: metaForForm.engine_cc ?? '',
              vehicle_year: metaForForm.vehicle_year ?? '',
              seats: metaForForm.seats ?? '',
              specialization: metaForForm.specialization ?? '',
              group_size_min: clampIntFromDigits(metaForForm.group_size_min ?? 1, 1, 999, 1),
              group_size_max: clampIntFromDigits(
                metaForForm.group_size_max ?? Math.max(metaForForm.group_size_min ?? 1, 10),
                1,
                999,
                Math.max(clampIntFromDigits(metaForForm.group_size_min ?? 1, 1, 999, 1), 10),
              ),
            },
            seasonalPricing: seasonal || listing.seasonalPricing || listing.seasonalPrices || [],
          })
          setServerListing(listing)
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
    [language, partnerCommissionRate, t],
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
  }, [aiDescQuota.exhausted, categories, formData, isEditMode, editId, language, t])

  const handleImageUpload = useCallback(
    async (files) => {
      const fileList = Array.from(files || []).filter((f) => f.type?.startsWith('image/'))
      if (fileList.length === 0) return
      setUploading(true)
      setUploadProgress(0)
      const folderId = editId || (uploadFolderRef.current ||= `wizard-${Date.now()}`)
      try {
        const { processAndUploadImages } = await import('@/lib/services/image-upload.service')
        const uploadedUrls = await processAndUploadImages(fileList, folderId, (p) => setUploadProgress(p))
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
    [editId, t],
  )

  const removeImage = useCallback(
    (index) => {
      setFormData((prev) => {
        const list = prev.images || []
        const imageUrl = list[index]
        if (editId && typeof imageUrl === 'string' && (imageUrl.includes('/listing-images/') || imageUrl.includes('supabase.co/storage'))) {
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
    [editId],
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
    } catch (e) {
      toast.error(t('geocodeSearchFailed'))
    } finally {
      setGeocoding(false)
    }
  }, [geocodeQuery, t])

  const selectGeocodeResult = useCallback((r) => {
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
  }, [])

  const handleMapSelect = useCallback((lat, lng, geo) => {
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
      setCustomDistricts((prev) => (prev.includes(geo.district) ? prev : [...prev, geo.district]))
    }
  }, [])

  const applyAirbnbPreview = useCallback((preview) => {
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
              if (d && !WIZARD_DISTRICTS.includes(d) && !n.includes(d)) n.push(d)
            }
            return n
          })
        })
      }
      return merged
    })
  }, [categories])

  const value = {
    language,
    t,
    tr,
    numberLocale,
    wizardMode,
    serverListing,
    listingNotFound,
    authLoading,
    isAuthenticated,
    getCategoryName: (slug, l) => getCategoryName(slug, l || language),
    getAmenityName: (slug, l) => getAmenityName(slug, l || language),
    editId,
    isEditMode,
    currentStep,
    setCurrentStep,
    loading,
    setLoading,
    savingDraft,
    setSavingDraft,
    uploading,
    uploadProgress,
    fileInputRef,
    uploadFolderRef,
    formData,
    setFormData,
    categories,
    setCategories,
    customDistricts,
    setCustomDistricts,
    newSeason,
    setNewSeason,
    partnerCommissionRate,
    setPartnerCommissionRate,
    pricingPolicy,
    setPricingPolicy,
    aiDescQuota,
    aiDescriptionLoading,
    handleAiImproveDescription,
    updateField,
    updateDescription,
    updateMetadata,
    updateDurationDiscountPercent,
    setCategoryId,
    setListingServiceType,
    wizardCategoriesForSelect,
    listingCategorySlug,
    transportWizard,
    toursWizard,
    hideAirbnbImportBlock,
    partnerAmenitySlugs,
    amenitiesHintKey,
    canProceed,
    progress,
    goNext,
    goBack,
    SEASON_TYPES,
    dayPickerLocale,
    geocodeQuery,
    setGeocodeQuery,
    geocodeResults,
    setGeocodeResults,
    geocoding,
    handleGeocode,
    selectGeocodeResult,
    handleMapSelect,
    coordsValid,
    pricingPreview,
    handleImageUpload,
    removeImage,
    applyAirbnbPreview,
    WIZARD_DISTRICTS,
    refreshAiDescriptionQuota,
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
