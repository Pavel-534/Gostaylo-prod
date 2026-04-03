'use client'

/**
 * GoStayLo Premium Multi-step Listing Wizard v2
 * 
 * Features:
 * - 5-step stepper UI with progress bar
 * - Real-time live preview card
 * - Category-specific dynamic fields
 * - Seasonal pricing integration
 * - Save draft functionality
 * - Professional Airbnb-inspired UX
 * - Multi-language support (RU, EN, ZH, TH)
 * 
 * @version 2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText, getCategoryName, getAmenityName } from '@/lib/translations'
import { clampIntFromDigits, sanitizeThbDigits } from '@/lib/listing-wizard-numeric'
import { AMENITY_SLUGS, normalizeWizardAmenities } from '@/lib/listing-wizard-amenities'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { 
  ArrowLeft, ArrowRight, Save, CheckCircle2, 
  Home, Bike, Anchor, Map as MapIcon, DollarSign, 
  ImageIcon, Building, Users, Bed, Bath, Loader2
} from 'lucide-react'
import { ProxiedImage } from '@/components/proxied-image'
import { toast } from 'sonner'
import { GostayloListingCard } from '@/components/gostaylo-listing-card'
import { PartnerCalendarEducationCard } from '@/components/partner/PartnerCalendarEducationCard'
import { PartnerListingImportBlock } from '@/components/partner/PartnerListingImportBlock'
import { mergeAirbnbPreviewWizard } from '@/lib/partner/listing-import-merge'
import {
  normalizePartnerListingMetadata,
  partnerMetadataStateFromServer,
  isPartnerListingHousingCategory,
} from '@/lib/partner/listing-wizard-metadata'
import {
  pickPartnerFormDescription,
  buildListingDescriptionForDb,
  mergeDescriptionTranslationsForSave,
} from '@/lib/partner/listing-description-i18n'
import { PartnerListingSearchMetadataFields } from '@/components/partner/PartnerListingSearchMetadataFields'
import {
  migrateExternalImagesAfterSave,
  mapCoverUrlAfterMigration,
  patchPartnerListingCoverImage,
} from '@/lib/partner/migrate-external-images-client'
import dynamic from 'next/dynamic'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { ru, enUS, zhCN, th as thDateLocale } from 'date-fns/locale'
import { getSeasonColor } from '@/lib/price-calculator'
import 'react-day-picker/dist/style.css'

const MapPicker = dynamic(() => import('@/components/listing/MapPicker'), { ssr: false })

const DISTRICTS = [
  'Rawai', 'Chalong', 'Kata', 'Karon', 'Patong', 'Kamala', 
  'Surin', 'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang'
]

export default function PremiumListingWizard() {
  const router = useRouter()
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)
  const dayPickerLocale = { ru, en: enUS, zh: zhCN, th: thDateLocale }[language] || ru

  const SEASON_TYPES = useMemo(
    () => [
      { value: 'LOW', label: getUIText('seasonLow', language), color: 'green' },
      { value: 'NORMAL', label: getUIText('seasonNormal', language), color: 'slate' },
      { value: 'HIGH', label: getUIText('seasonHigh', language), color: 'orange' },
      { value: 'PEAK', label: getUIText('seasonPeak', language), color: 'red' },
    ],
    [language],
  )

  const searchParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const editId = searchParams.get('edit')
  const isEditMode = !!editId
  const fileInputRef = useRef(null)

  const STEPS = [
    { id: 1, label: t('basics'), icon: Home },
    { id: 2, label: t('location'), icon: MapIcon },
    { id: 3, label: t('specs'), icon: Building },
    { id: 4, label: t('pricing'), icon: DollarSign },
    { id: 5, label: t('gallery'), icon: ImageIcon }
  ]
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [aiDescriptionLoading, setAiDescriptionLoading] = useState(false)
  const [aiDescQuota, setAiDescQuota] = useState({
    used: 0,
    limit: 3,
    remaining: 3,
    exhausted: false,
  })
  const [geocodeQuery, setGeocodeQuery] = useState('')
  const [geocodeResults, setGeocodeResults] = useState([])
  const [customDistricts, setCustomDistricts] = useState([]) // From map reverse geocode
  const [categories, setCategories] = useState([])
  const [newSeason, setNewSeason] = useState({ 
    label: '', 
    dateRange: { from: null, to: null }, 
    priceDaily: '', 
    priceMonthly: '',
    seasonType: 'NORMAL' 
  })
  const [partnerCommissionRate, setPartnerCommissionRate] = useState(null)
  
  // Form data
  const [formData, setFormData] = useState({
    categoryId: '',
    categoryName: '',
    title: '',
    description: '',
    district: '',
    latitude: null,
    longitude: null,
    basePriceThb: '',
    commissionRate: '',
    minBookingDays: 1,
    maxBookingDays: 90,
    images: [],
    coverImage: '',
    metadata: {
      bedrooms: 0,
      bathrooms: 0,
      max_guests: 2,
      area: 0,
      amenities: [],
      property_type: 'Villa',
      // Yacht-specific
      passengers: 0,
      engine: '',
      // Tour-specific
      duration: '',
      includes: [],
      transmission: '',
      fuel_type: '',
      engine_cc: '',
      languages: [],
      experience_years: '',
      specialization: '',
    },
    seasonalPricing: []
  })
  
  // Load categories and partner commission
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Load categories
        const catRes = await fetch('/api/v2/categories')
        const catData = await catRes.json()
        if (catData.success) {
          setCategories(catData.data || [])
        }
        
        // Load partner commission rate (system or individual)
        let userId = localStorage.getItem('gostaylo_user_id')
        if (!userId) {
          const meRes = await fetch('/api/v2/auth/me', { credentials: 'include' })
          const meData = await meRes.json()
          if (meData.success && meData.user?.id) userId = meData.user.id
        }
        if (userId) {
          const commissionRes = await fetch(`/api/v2/commission?partnerId=${userId}`, { credentials: 'include' })
          const commissionData = await commissionRes.json()
          if (commissionData.success && commissionData.data) {
            const rate =
              commissionData.data.effectiveRate ?? commissionData.data.systemRate
            if (rate != null && Number.isFinite(Number(rate))) {
              const n = Number(rate)
              setPartnerCommissionRate(n)
              setFormData((prev) => ({ ...prev, commissionRate: n }))
            }
          }
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
      }
    }
    loadInitialData()
  }, [])

  async function refreshAiDescriptionQuota() {
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
  }

  useEffect(() => {
    if (currentStep === 1) refreshAiDescriptionQuota()
  }, [currentStep, isEditMode, editId])
  
  // Load existing listing for edit (prefer partner API for security)
  async function loadExistingListing(listingId) {
    try {
      setLoading(true)
      // Use partner API (verifies ownership, returns full data)
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, { credentials: 'include' })
      const data = await res.json()
      const listing = data.data || data.listing
      
      if (data.success && listing) {
        const cat = listing.category || listing.categories
        const rawSeasonal = listing.seasonalPricing || listing.seasonalPrices || []
        const seasonal = rawSeasonal.map((s, i) => ({
          id: s.id || `s-${i}`,
          label: s.label || 'Season',
          startDate: s.startDate || s.start_date,
          endDate: s.endDate || s.end_date,
          priceDaily: s.priceDaily ?? s.price_daily ?? 0,
          seasonType: s.seasonType || s.season_type || 'high',
        }))
        const rawMeta = listing.metadata || {}
        const shapedMeta = partnerMetadataStateFromServer(rawMeta)
        const listingDesc = listing.description || ''
        setFormData({
          categoryId: listing.categoryId || listing.category_id || '',
          categoryName: cat?.name || '',
          title: listing.title || '',
          description: pickPartnerFormDescription(language, listingDesc, rawMeta),
          district: listing.district || '',
          latitude: listing.latitude ?? null,
          longitude: listing.longitude ?? null,
          basePriceThb:
            sanitizeThbDigits((listing.basePriceThb ?? listing.base_price_thb)?.toString() || '') ||
            '',
          commissionRate: listing.commissionRate ?? listing.commission_rate ?? partnerCommissionRate,
          minBookingDays: clampIntFromDigits(
            listing.minBookingDays ?? listing.min_booking_days ?? 1,
            1,
            365,
            1,
          ),
          maxBookingDays: clampIntFromDigits(
            listing.maxBookingDays ?? listing.max_booking_days ?? 90,
            1,
            730,
            90,
          ),
          images: listing.images || [],
          coverImage: listing.coverImage || listing.cover_image || '',
          metadata: {
            bedrooms: 0,
            bathrooms: 0,
            max_guests: 2,
            area: 0,
            amenities: [],
            property_type: 'Villa',
            passengers: 0,
            engine: '',
            duration: '',
            includes: [],
            transmission: '',
            fuel_type: '',
            engine_cc: '',
            languages: [],
            experience_years: '',
            specialization: '',
            ...shapedMeta,
            bedrooms: clampIntFromDigits(shapedMeta.bedrooms ?? 0, 0, 99, 0),
            bathrooms: clampIntFromDigits(shapedMeta.bathrooms ?? 0, 0, 99, 0),
            max_guests: clampIntFromDigits(shapedMeta.max_guests ?? 2, 1, 999, 1),
            area: clampIntFromDigits(shapedMeta.area ?? 0, 0, 9_999_999, 0),
            passengers: clampIntFromDigits(shapedMeta.passengers ?? rawMeta.passengers ?? 0, 0, 999, 0),
            amenities: normalizeWizardAmenities(rawMeta.amenities || []),
            languages: Array.isArray(shapedMeta.languages) ? shapedMeta.languages : [],
            experience_years: shapedMeta.experience_years ?? '',
            transmission: shapedMeta.transmission ?? '',
            fuel_type: shapedMeta.fuel_type ?? '',
            engine_cc: shapedMeta.engine_cc ?? '',
            specialization: shapedMeta.specialization ?? '',
          },
          seasonalPricing: seasonal || listing.seasonalPricing || listing.seasonalPrices || [],
        })
      }
    } catch (error) {
      console.error('Failed to load listing:', error)
      toast.error(t('failedToLoadListing'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isEditMode || !editId) return
    loadExistingListing(editId)
  }, [editId, isEditMode])
  
  // Progress calculation
  const progress = useMemo(() => {
    return ((currentStep - 1) / (STEPS.length - 1)) * 100
  }, [currentStep])
  
  // Update form field
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateDescription = (value) => {
    setFormData((prev) => {
      const meta = { ...prev.metadata }
      const dt = { ...(meta.description_translations && typeof meta.description_translations === 'object' ? meta.description_translations : {}) }
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
  }

  async function handleAiImproveDescription() {
    if (!formData.title || formData.title.trim().length < 10) {
      toast.error(language === 'ru' ? 'Сначала укажите название (от 10 символов)' : 'Add a title first (min 10 characters)')
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
      const ru = String(data.data?.descriptionRu || '').slice(0, 2000)
      const en = String(data.data?.descriptionEn || '').slice(0, 2000)
      const zh = String(data.data?.descriptionZh || '').slice(0, 2000)
      const th = String(data.data?.descriptionTh || '').slice(0, 2000)
      const seo = data.data?.seo || {}
      const byLang = { ru, en, zh, th }
      const shown = (byLang[language] || en || ru).slice(0, 2000)
      if (data.data?.quota) setAiDescQuota(data.data.quota)
      setFormData((prev) => {
        const meta = { ...prev.metadata }
        const prevSeo = meta.seo && typeof meta.seo === 'object' ? meta.seo : {}
        return {
          ...prev,
          description: shown,
          metadata: {
            ...meta,
            description_translations: { ru, en, zh, th },
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
      toast.success(
        language === 'ru' ? 'Описание и SEO обновлены (RU, EN, ZH, TH)' : 'Descriptions & SEO updated (4 languages)',
      )
    } catch (e) {
      console.error(e)
      toast.error(t('failedToLoadListing'))
    } finally {
      setAiDescriptionLoading(false)
    }
  }
  
  // Update metadata field
  const updateMetadata = (field, value) => {
    setFormData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, [field]: value }
    }))
  }

  // Image upload via API
  async function handleImageUpload(files) {
    const fileList = Array.from(files || [])
    if (fileList.length === 0) return
    setUploading(true)
    const folder = editId || `temp-${Date.now()}`
    const newUrls = []
    try {
      for (const file of fileList) {
        if (!file.type?.startsWith('image/')) continue
        const fd = new FormData()
        fd.append('file', file)
        fd.append('bucket', 'listings')
        fd.append('folder', folder)
        const res = await fetch('/api/v2/upload', {
          method: 'POST',
          credentials: 'include',
          body: fd
        })
        const data = await res.json()
        if (data.success && data.url) newUrls.push(data.url)
      }
      if (newUrls.length > 0) {
        setFormData(prev => ({ ...prev, images: [...(prev.images || []), ...newUrls] }))
        toast.success(`+${newUrls.length} ${t('photosUploadedToast')}`)
      }
    } catch (e) {
      console.error(e)
      toast.error(t('uploadFailedToast'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function removeImage(index) {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }))
  }

  // Geocoding: search address → set coordinates
  async function handleGeocode() {
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
  }

  function selectGeocodeResult(r) {
    updateField('latitude', r.lat)
    updateField('longitude', r.lon)
    setGeocodeResults([])
    setGeocodeQuery('')
  }

  // Coordinate validation: lat -90..90, lng -180..180
  const coordsValid = useMemo(() => {
    const lat = formData.latitude
    const lng = formData.longitude
    if (lat == null || lng == null) return true
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  }, [formData.latitude, formData.longitude])
  
  // Validation for each step
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 1:
        return formData.categoryId && formData.title.length >= 10 && formData.description.length >= 20
      case 2:
        return formData.district && coordsValid
      case 3:
        return true // Always allow (specs are optional)
      case 4:
        return parseFloat(String(formData.basePriceThb).replace(',', '.')) > 0
      case 5:
        return formData.images.length >= 1
      default:
        return false
    }
  }, [currentStep, formData])
  
  // Navigation
  const goNext = () => {
    if (canProceed && currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1)
    }
  }
  
  const goBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1)
    }
  }
  
  // Save draft (creates new or updates existing)
  const saveDraft = async () => {
    setSavingDraft(true)
    try {
      const userId = localStorage.getItem('gostaylo_user_id')
      if (!userId) {
        toast.error(t('pleaseLogIn'))
        return
      }

      const categorySlug = categories.find((c) => c.id === formData.categoryId)?.slug ?? ''
      const descTranslations = mergeDescriptionTranslationsForSave(formData, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...formData, metadata: { ...formData.metadata, description_translations: descTranslations } },
        language,
      )
      const draftMeta = normalizePartnerListingMetadata(
        { ...formData.metadata, description_translations: descTranslations, is_draft: true },
        categorySlug,
      )

      if (isEditMode && editId) {
        // Update existing draft/listing
        const payload = {
          ...formData,
          description: descriptionDb,
          status: formData.status || 'INACTIVE',
          available: false,
          basePriceThb: parseFloat(formData.basePriceThb) || 0,
          images: formData.images,
          metadata: draftMeta,
        }
        const res = await fetch(`/api/v2/partner/listings/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (data.success) {
          const lid = editId
          const mig = await migrateExternalImagesAfterSave(lid, formData.images)
          if (mig?.images?.length) {
            const cover = mapCoverUrlAfterMigration(
              formData.images,
              formData.coverImage,
              mig.images
            )
            if (cover) await patchPartnerListingCoverImage(lid, cover)
          }
          toast.success(t('draftSaved'))
          router.push('/partner/listings')
        } else {
          toast.error(data.error || t('failedToLoadListing'))
        }
      } else {
        // Create new draft → сразу ?edit=id, чтобы квота ИИ считалась по listing_id
        const payload = {
          ownerId: userId,
          categoryId: formData.categoryId,
          title: formData.title || 'Черновик',
          description: descriptionDb,
          district: formData.district || '',
          basePriceThb: parseFloat(formData.basePriceThb) || 0,
          images: formData.images || [],
          metadata: draftMeta,
          status: 'INACTIVE',
          available: false
        }
        const res = await fetch('/api/v2/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (data.success) {
          const lid = data.data?.id
          const mig = await migrateExternalImagesAfterSave(lid, formData.images)
          if (mig?.images?.length) {
            const cover = mapCoverUrlAfterMigration(
              formData.images,
              formData.coverImage,
              mig.images
            )
            if (cover) await patchPartnerListingCoverImage(lid, cover)
          }
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
  }
  
  // Final submit (publish)
  const handleSubmit = async () => {
    setLoading(true)
    try {
      const userId = localStorage.getItem('gostaylo_user_id')
      if (!userId) {
        toast.error(t('pleaseLogIn'))
        return
      }
      
      const categorySlug = categories.find((c) => c.id === formData.categoryId)?.slug ?? ''
      const descTranslations = mergeDescriptionTranslationsForSave(formData, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...formData, metadata: { ...formData.metadata, description_translations: descTranslations } },
        language,
      )
      const publishMeta = normalizePartnerListingMetadata(
        { ...formData.metadata, description_translations: descTranslations, is_draft: false },
        categorySlug,
      )

      const payload = {
        ...formData,
        description: descriptionDb,
        ownerId: userId,
        status: 'PENDING',
        available: true,
        basePriceThb: parseFloat(formData.basePriceThb) || 0,
        commissionRate: Number.isFinite(parseFloat(formData.commissionRate))
          ? parseFloat(formData.commissionRate)
          : partnerCommissionRate,
        minBookingDays: parseInt(formData.minBookingDays) || 1,
        maxBookingDays: parseInt(formData.maxBookingDays) || 90,
        metadata: publishMeta,
      }
      
      const method = isEditMode ? 'PUT' : 'POST'
      const url = isEditMode ? `/api/v2/partner/listings/${editId}` : '/api/v2/listings'
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      
      const data = await res.json()
      if (data.success) {
        const listingId = data.data?.id || data.listing?.id || editId
        const mig = await migrateExternalImagesAfterSave(listingId, formData.images)
        if (mig?.images?.length) {
          const cover = mapCoverUrlAfterMigration(
            formData.images,
            formData.coverImage,
            mig.images
          )
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
                  label: s.label || 'Season',
                  seasonType: (s.seasonType || 'NORMAL').toUpperCase(),
                }),
              })
            } catch (e) {
              console.warn('Seasonal price save failed:', e)
            }
          }
        }
        toast.success(isEditMode ? t('listingUpdated') : t('listingPublished'))
        if (listingId && !isEditMode) {
          router.push(`/partner/listings/${listingId}?highlight=calendar`)
        } else {
          router.push('/partner/listings')
        }
      } else {
        toast.error(data.error || t('failedToLoadListing'))
      }
    } catch (error) {
      toast.error(t('failedToLoadListing'))
    } finally {
      setLoading(false)
    }
  }

  const mapCategorySlug = useMemo(
    () => categories.find((c) => c.id === formData.categoryId)?.slug ?? '',
    [categories, formData.categoryId]
  )

  // Dynamic fields based on category
  const renderSpecs = () => {
    const categoryName = formData.categoryName?.toLowerCase() || ''
    const slug = (mapCategorySlug || '').toLowerCase()

    if (slug === 'yachts' || categoryName.includes('yacht') || categoryName.includes('boat')) {
      return (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label className="text-sm font-medium text-slate-700">{t('fieldPassengers')}</Label>
              <Input
                inputMode="numeric"
                autoComplete="off"
                value={String(formData.metadata.passengers)}
                onChange={(e) =>
                  updateMetadata('passengers', clampIntFromDigits(e.target.value, 1, 999, 1))
                }
                className="mt-2 h-11"
              />
            </div>
            <div>
              <Label className="text-sm font-medium text-slate-700">{t('fieldEngineType')}</Label>
              <Input
                type="text"
                placeholder={t('fieldEnginePlaceholder')}
                value={formData.metadata.engine}
                onChange={(e) => updateMetadata('engine', e.target.value)}
                className="mt-2 h-11"
              />
            </div>
          </div>
        </>
      )
    }

    if (slug === 'tours' || categoryName.includes('tour')) {
      return (
        <>
          <div>
            <Label className="text-sm font-medium text-slate-700">{t('fieldDuration')}</Label>
            <Input
              type="text"
              placeholder={t('fieldDurationPlaceholder')}
              value={formData.metadata.duration}
              onChange={(e) => updateMetadata('duration', e.target.value)}
              className="mt-2 h-11"
            />
          </div>
        </>
      )
    }

    if (
      slug === 'vehicles' ||
      slug === 'nanny' ||
      slug === 'babysitter' ||
      isPartnerListingHousingCategory(slug, formData.categoryName)
    ) {
      return (
        <PartnerListingSearchMetadataFields
          categorySlug={slug}
          categoryNameFallback={formData.categoryName}
          language={language}
          metadata={formData.metadata}
          updateMetadata={updateMetadata}
          variant="wizard"
        />
      )
    }

    return (
      <div className="text-center py-8 text-slate-500">
        <Building className="h-12 w-12 mx-auto mb-2 text-slate-300" />
        <p>{t('selectCategoryToSeeFields')}</p>
      </div>
    )
  }
  
  // Render current step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{t('tellUsAboutListing')}</h2>
              <p className="text-slate-600">{t('startWithBasics')}</p>
            </div>
            
            <div>
              <Label className="text-base font-medium">{t('selectCategory')}</Label>
              <Select 
                value={formData.categoryId} 
                onValueChange={(value) => {
                  const cat = categories.find(c => c.id === value)
                  updateField('categoryId', value)
                  updateField('categoryName', cat?.name || '')
                }}
              >
                <SelectTrigger className="mt-2 h-12">
                  <SelectValue placeholder={t('selectCategoryPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {getCategoryName(cat.slug, language) || cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <PartnerListingImportBlock
              categoryId={formData.categoryId}
              variant="wizard"
              listingId={isEditMode && editId ? editId : undefined}
              migrateImportedImagesToStorage={!!(isEditMode && editId)}
              onApplyPreview={(preview) => {
                setFormData((prev) => {
                  const { nextFormData, customDistrictsToAdd } = mergeAirbnbPreviewWizard(prev, preview)
                  const merged = {
                    ...nextFormData,
                    metadata: {
                      ...nextFormData.metadata,
                      amenities: normalizeWizardAmenities(nextFormData.metadata?.amenities || []),
                    },
                  }
                  if (customDistrictsToAdd.length) {
                    Promise.resolve().then(() => {
                      setCustomDistricts((dprev) => {
                        const n = [...dprev]
                        for (const d of customDistrictsToAdd) {
                          if (d && !DISTRICTS.includes(d) && !n.includes(d)) n.push(d)
                        }
                        return n
                      })
                    })
                  }
                  return merged
                })
              }}
            />
            
            <div>
              <Label className="text-base font-medium text-slate-800">{t('listingTitleLabel')}</Label>
              <Input
                type="text"
                placeholder={t('titlePlaceholder')}
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="mt-2 h-12"
                maxLength={100}
              />
              <p className="mt-1 text-xs text-slate-500">
                {formData.title.length}/100 {t('characters')}
              </p>
            </div>

            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label className="text-base font-medium text-slate-800">{t('listingDescriptionLabel')}</Label>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 border-violet-200 bg-violet-50/80 text-violet-900 hover:bg-violet-100 disabled:opacity-50"
                          disabled={aiDescriptionLoading || aiDescQuota.exhausted}
                          onClick={handleAiImproveDescription}
                        >
                          {aiDescriptionLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t('improveDescriptionAILoading')}
                            </>
                          ) : (
                            t('improveDescriptionAI')
                          )}
                        </Button>
                      </span>
                    </TooltipTrigger>
                    {aiDescQuota.exhausted ? (
                      <TooltipContent side="bottom" className="max-w-xs">
                        <p>{t('improveDescriptionAILimitExhausted')}</p>
                      </TooltipContent>
                    ) : null}
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="mt-1 text-xs text-slate-500">{t('improveDescriptionAIHint')}</p>
              <p className="mt-1 text-xs text-slate-600">
                {t('improveDescriptionAIQuotaUsed')
                  .replace('{{used}}', String(aiDescQuota.used))
                  .replace('{{limit}}', String(aiDescQuota.limit))}
              </p>
              <Textarea
                placeholder={t('descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) => updateDescription(e.target.value)}
                className="mt-2 min-h-[120px]"
                maxLength={2000}
              />
              <p className="mt-1 text-xs text-slate-500">
                {formData.description.length}/2000 {t('characters')}
              </p>
            </div>
          </div>
        )
      
      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{t('whereIsListing')}</h2>
              <p className="text-slate-600">{t('helpGuestsFind')}</p>
            </div>
            
            <div>
              <Label className="text-base font-medium">{t('selectDistrict')}</Label>
              <Select value={formData.district} onValueChange={(value) => updateField('district', value)}>
                <SelectTrigger className="mt-2 h-12">
                  <SelectValue placeholder={t('selectDistrictPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {[...DISTRICTS, ...customDistricts.filter(d => !DISTRICTS.includes(d))].map(d => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Geocoding search */}
            <div>
              <Label className="text-base font-medium">{t('searchAddress')}</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder={t('searchAddressPlaceholder')}
                  value={geocodeQuery}
                  onChange={(e) => setGeocodeQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGeocode())}
                  className="flex-1"
                />
                <Button variant="outline" onClick={handleGeocode} disabled={geocoding}>
                  {geocoding ? <Loader2 className="h-4 w-4 animate-spin" /> : t('search')}
                </Button>
              </div>
              {geocodeResults.length > 0 && (
                <div className="mt-2 border rounded-lg divide-y max-h-40 overflow-y-auto">
                  {geocodeResults.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm"
                      onClick={() => selectGeocodeResult(r)}
                    >
                      {r.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            {/* Interactive map */}
            <div>
              <Label className="text-base font-medium">{t('mapLocation')}</Label>
              <p className="text-xs text-slate-500 mt-1">{t('clickToPin')}</p>
              <div className="mt-2">
                <MapPicker
                  categoryId={formData.categoryId}
                  categorySlug={mapCategorySlug}
                  language={language}
                  latitude={formData.latitude}
                  longitude={formData.longitude}
                  onSelect={(lat, lng, geo) => {
                    updateField('latitude', lat)
                    updateField('longitude', lng)
                    if (geo?.district) {
                      updateField('district', geo.district)
                      setGeocodeQuery(geo.displayName || geo.district)
                      setCustomDistricts((prev) =>
                        prev.includes(geo.district) ? prev : [...prev, geo.district]
                      )
                    }
                    if (geo?.city) updateMetadata('city', geo.city)
                  }}
                  height={280}
                />
              </div>
            </div>
            
            {/* Manual coordinates + validation */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">{t('latitude')}</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="7.8235"
                  value={formData.latitude ?? ''}
                  onChange={(e) => updateField('latitude', e.target.value ? parseFloat(e.target.value) : null)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">{t('longitude')}</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="98.3828"
                  value={formData.longitude ?? ''}
                  onChange={(e) => updateField('longitude', e.target.value ? parseFloat(e.target.value) : null)}
                  className="mt-1"
                />
              </div>
            </div>
            {!coordsValid && (
              <p className="text-sm text-amber-600">{t('invalidCoords')}</p>
            )}
          </div>
        )
      
      case 3:
        return (
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">{t('listingSpecs')}</h2>
              <p className="text-slate-600 leading-relaxed">
                {t('addDetailsFor')}{' '}
                {getCategoryName(mapCategorySlug, language) || formData.categoryName || ''}.
              </p>
            </div>

            {renderSpecs()}

            <div className="space-y-3 pt-2">
              <Label className="text-base font-medium text-slate-800">{t('amenities')}</Label>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {AMENITY_SLUGS.map((slug) => {
                  const selected = formData.metadata.amenities?.includes(slug)
                  return (
                    <Button
                      key={slug}
                      variant={selected ? 'default' : 'outline'}
                      size="sm"
                      type="button"
                      onClick={() => {
                        const current = formData.metadata.amenities || []
                        const updated = selected
                          ? current.filter((a) => a !== slug)
                          : [...current, slug]
                        updateMetadata('amenities', updated)
                      }}
                      className={`h-auto min-h-10 whitespace-normal px-3 py-2 text-center text-sm leading-snug ${
                        selected ? 'bg-teal-600 hover:bg-teal-700' : ''
                      }`}
                    >
                      {getAmenityName(slug, language, slug)}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      
      case 4:
        return (
          <div className="space-y-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">{t('pricingAndBooking')}</h2>
              <p className="text-slate-600 leading-relaxed">{t('setRates')}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <Label className="text-base font-medium text-slate-800">{t('basePrice')}</Label>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={t('basePricePlaceholder')}
                  value={formData.basePriceThb}
                  onChange={(e) => updateField('basePriceThb', sanitizeThbDigits(e.target.value))}
                  className="mt-2 h-12"
                />
              </div>
              <div className="flex flex-col justify-end rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                <p className="text-sm font-medium text-slate-700">{t('systemCommission')}</p>
                <p className="text-lg font-semibold text-teal-600 mt-1">{partnerCommissionRate}%</p>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                  {partnerCommissionRate !== 15 ? t('partnerCommissionPersonal') : t('partnerCommissionStandard')}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <Label className="text-base font-medium text-slate-800">{t('minStay')}</Label>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  value={String(formData.minBookingDays)}
                  onChange={(e) =>
                    updateField('minBookingDays', clampIntFromDigits(e.target.value, 1, 365, 1))
                  }
                  className="mt-2 h-12"
                />
              </div>
              <div>
                <Label className="text-base font-medium text-slate-800">{t('maxStay')}</Label>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  value={String(formData.maxBookingDays)}
                  onChange={(e) =>
                    updateField('maxBookingDays', clampIntFromDigits(e.target.value, 1, 730, 90))
                  }
                  className="mt-2 h-12"
                />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium text-slate-800">{t('seasonalPricing')}</Label>
              <p className="text-sm text-slate-500 leading-relaxed">{t('seasonalPricingDesc')}</p>
              <div className="mt-1 space-y-5">
                <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50/90 p-2 sm:p-4">
                  <Label className="mb-2 block text-sm font-medium text-slate-800">
                    {t('wizardDateRange')}
                  </Label>
                  <div className="-mx-1 w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-contain sm:mx-0 [scrollbar-gutter:stable]">
                    <div className="inline-flex min-w-full justify-center px-1 pb-1 sm:px-0">
                      <DayPicker
                        mode="range"
                        selected={newSeason.dateRange}
                        onSelect={(range) =>
                          setNewSeason((s) => ({
                            ...s,
                            dateRange: range || { from: null, to: null },
                          }))
                        }
                        locale={dayPickerLocale}
                        className="rdp-root !p-0 [--rdp-day-width:2.25rem] [--rdp-day-height:2.25rem] [--rdp-day_button-width:2.125rem] [--rdp-day_button-height:2.125rem] sm:[--rdp-day-width:2.75rem] sm:[--rdp-day-height:2.75rem] sm:[--rdp-day_button-width:2.625rem] sm:[--rdp-day_button-height:2.625rem] [&_.rdp-weekday]:text-[0.65rem] sm:[&_.rdp-weekday]:text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-slate-600">
                      {t('seasonLabel')}
                    </Label>
                    <Input
                      placeholder={t('seasonLabelExamplePlaceholder')}
                      value={newSeason.label}
                      onChange={(e) => setNewSeason((s) => ({ ...s, label: e.target.value }))}
                      className="h-11"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-slate-600">
                      {t('seasonTypeLabel')}
                    </Label>
                    <Select
                      value={newSeason.seasonType}
                      onValueChange={(v) => setNewSeason((s) => ({ ...s, seasonType: v }))}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SEASON_TYPES.map((st) => (
                          <SelectItem key={st.value} value={st.value}>
                            {st.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-slate-600">
                      {t('pricePerDayShort')}
                    </Label>
                    <Input
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="15000"
                      value={newSeason.priceDaily}
                      onChange={(e) =>
                        setNewSeason((s) => ({ ...s, priceDaily: sanitizeThbDigits(e.target.value) }))
                      }
                      className="h-11"
                    />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs font-medium text-slate-600">
                      {t('pricePerMonthOptional')}
                    </Label>
                    <Input
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="—"
                      value={newSeason.priceMonthly}
                      onChange={(e) =>
                        setNewSeason((s) => ({ ...s, priceMonthly: sanitizeThbDigits(e.target.value) }))
                      }
                      className="h-11"
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  className="h-10"
                  onClick={() => {
                    const from = newSeason.dateRange?.from
                    const to = newSeason.dateRange?.to || newSeason.dateRange?.from
                    if (newSeason.label && from && to && newSeason.priceDaily) {
                      setFormData((prev) => ({
                        ...prev,
                        seasonalPricing: [
                          ...(prev.seasonalPricing || []),
                          {
                            id: `s-${Date.now()}`,
                            label: newSeason.label,
                            startDate: format(from, 'yyyy-MM-dd'),
                            endDate: format(to, 'yyyy-MM-dd'),
                            priceDaily: parseFloat(newSeason.priceDaily) || 0,
                            priceMonthly: newSeason.priceMonthly
                              ? parseFloat(newSeason.priceMonthly)
                              : null,
                            seasonType: newSeason.seasonType,
                          },
                        ],
                      }))
                      setNewSeason({
                        label: '',
                        dateRange: { from: null, to: null },
                        priceDaily: '',
                        priceMonthly: '',
                        seasonType: 'NORMAL',
                      })
                      toast.success(t('seasonAddedToast'))
                    } else {
                      toast.error(t('seasonFillErrorToast'))
                    }
                  }}
                >
                  <DollarSign className="mr-2 h-4 w-4" />
                  {t('addSeason')}
                </Button>
                {(formData.seasonalPricing || []).length > 0 && (
                  <div className="mt-3 space-y-2">
                    {formData.seasonalPricing.map((s, i) => {
                      const colors = getSeasonColor(s.seasonType || 'NORMAL')
                      return (
                        <div
                          key={s.id || i}
                          className={`flex flex-col gap-2 rounded-lg border py-2.5 px-3 sm:flex-row sm:items-center sm:justify-between ${colors.bg} ${colors.border}`}
                        >
                          <span className="text-sm leading-snug">
                            {s.label} ({s.seasonType || 'NORMAL'}): {s.startDate} — {s.endDate} • ฿
                            {s.priceDaily}
                            {t('perNightShort')}
                            {s.priceMonthly ? ` • ฿${s.priceMonthly}${t('perMonthShort')}` : ''}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="shrink-0 self-end text-red-600 hover:text-red-700 sm:self-auto"
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                seasonalPricing: (prev.seasonalPricing || []).filter((_, j) => j !== i),
                              }))
                            }
                          >
                            {t('removeSeason')}
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      
      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{t('addPhotos')}</h2>
              <p className="text-slate-600">{t('showcasePhotos')}</p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleImageUpload(e.target.files)}
            />
            <div
              className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center hover:border-teal-500 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="h-16 w-16 mx-auto mb-4 text-slate-400" />
              <h3 className="text-lg font-medium mb-2">{t('dragDropImages')}</h3>
              <p className="text-slate-500 mb-4">{t('orClickToBrowse')}</p>
              <Button variant="outline" disabled={uploading} type="button">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('selectFiles')}
              </Button>
            </div>
            
            {formData.images.length > 0 && (
              <div className="grid grid-cols-4 gap-4">
                {formData.images.map((img, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                    <ProxiedImage src={img} alt={`Upload ${idx + 1}`} fill className="object-cover" sizes="25vw" />
                    {idx === 0 && (
                      <Badge className="absolute left-2 top-2 bg-teal-600">{t('coverBadge')}</Badge>
                    )}
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); removeImage(idx) }}
                    >
                      ×
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <PartnerCalendarEducationCard variant="wizard" className="mt-8" />
          </div>
        )
      
      default:
        return null
    }
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with Progress */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={() => router.push('/partner/listings')}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('exit')}
            </Button>

            <h1 className="text-center text-lg font-semibold tracking-tight sm:text-xl">
              {isEditMode ? t('editListing') : t('createNewListing')}
            </h1>

            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={savingDraft}
              className="gap-2"
            >
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t('saveDraft')}
            </Button>
          </div>
          
          {/* Progress Bar */}
          <div className="pb-4">
            <Progress value={progress} className="h-2" />
            <div className="flex items-center justify-between mt-3">
              {STEPS.map((step) => {
                const Icon = step.icon
                const isActive = currentStep === step.id
                const isComplete = currentStep > step.id
                
                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isComplete 
                        ? 'bg-teal-600 border-teal-600 text-white' 
                        : isActive 
                        ? 'border-teal-600 text-teal-600 bg-white' 
                        : 'border-slate-300 text-slate-400 bg-white'
                    }`}>
                      {isComplete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span className={`text-xs mt-1 font-medium ${isActive ? 'text-teal-600' : 'text-slate-500'}`}>
                      {step.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT: Wizard Form */}
          <div className="lg:col-span-2">
            <Card className="border-slate-200 shadow-sm">
              <CardContent className="p-5 sm:p-8">
                {renderStepContent()}
                
                <Separator className="my-8" />
                
                {/* Navigation Buttons */}
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={goBack}
                    disabled={currentStep === 1}
                    className="gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    {t('back')}
                  </Button>
                  
                  {currentStep < STEPS.length ? (
                    <Button
                      onClick={goNext}
                      disabled={!canProceed}
                      className="bg-teal-600 hover:bg-teal-700 gap-2"
                    >
                      {t('next')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      onClick={handleSubmit}
                      disabled={!canProceed || loading}
                      className="bg-teal-600 hover:bg-teal-700 gap-2"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                      {isEditMode ? t('updateListing') : t('publishListing')}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* RIGHT: Live Preview */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <h3 className="mb-4 text-lg font-semibold tracking-tight text-slate-800">
                {t('livePreview')}
              </h3>
              <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <GostayloListingCard
                    listing={{
                      id: 'preview',
                      title: formData.title || t('previewTitlePlaceholder'),
                      district: formData.district || t('previewDistrictPlaceholder'),
                      basePriceThb: parseFloat(formData.basePriceThb) || 0,
                      base_price_thb: parseFloat(formData.basePriceThb) || 0,
                      coverImage: formData.images[0] || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image',
                      cover_image: formData.images[0] || 'https://placehold.co/600x400/e2e8f0/64748b?text=No+Image',
                      images: formData.images.length > 0 ? formData.images : ['https://placehold.co/600x400/e2e8f0/64748b?text=No+Image'],
                      rating: 0,
                      reviewsCount: 0,
                      reviews_count: 0,
                      metadata: formData.metadata,
                      isFeatured: false,
                      is_featured: false
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
