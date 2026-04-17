'use client'

import { useState, useEffect, useRef } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ArrowLeft, Save, Loader2, Calendar, X, Upload, Star, 
  Trash2, Image as ImageIcon, FileImage, AlertCircle, CheckCircle2, Plus, Send
} from 'lucide-react'
import { toast } from 'sonner'
import CalendarSyncManager from '@/components/calendar-sync-manager'
import AvailabilityCalendar from '@/components/availability-calendar'
import SeasonalPriceManager from '@/components/seasonal-price-manager'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText, getAmenityName } from '@/lib/translations'
import { sanitizeThbDigits, clampIntFromDigits } from '@/lib/listing-wizard-numeric'
import {
  normalizeWizardAmenities,
  amenitySlugsForPartnerCategory,
  filterAmenitiesForPartnerCategory,
} from '@/lib/listing-wizard-amenities'
import { isTransportListingCategory, isTourListingCategory } from '@/lib/listing-category-slug'
import { ProxiedImage } from '@/components/proxied-image'
import { PartnerListingImportBlock } from '@/components/partner/PartnerListingImportBlock'
import { mergeAirbnbPreviewEdit } from '@/lib/partner/listing-import-merge'
import {
  migrateExternalImagesAfterSave,
  patchPartnerListingCoverImage,
} from '@/lib/partner/migrate-external-images-client'
import {
  normalizePartnerListingMetadata,
  partnerMetadataStateFromServer,
  mergeTourGroupMetadataFromListingColumns,
} from '@/lib/partner/listing-wizard-metadata'
import {
  pickPartnerFormDescription,
  buildListingDescriptionForDb,
  mergeDescriptionTranslationsForSave,
} from '@/lib/partner/listing-description-i18n'
import { PartnerListingSearchMetadataFields } from '@/components/partner/PartnerListingSearchMetadataFields'
import { PartnerListingDurationDiscountFields } from '@/components/partner/PartnerListingDurationDiscountFields'
import { applyDurationDiscountField } from '@/lib/partner/duration-discount-helpers'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const MapPicker = dynamic(() => import('@/components/listing/MapPicker'), { ssr: false })

export default function EditListing({ params }) {
  const router = useRouter()
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)
  const tr = (key, vars) => {
    let s = getUIText(key, language)
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        s = s.split(`{{${k}}}`).join(String(v))
      }
    }
    return s
  }
  const listingId = params?.id
  const fileInputRef = useRef(null)
  
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  
  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [aiDescriptionLoading, setAiDescriptionLoading] = useState(false)
  const [aiDescQuota, setAiDescQuota] = useState({
    used: 0,
    limit: 3,
    remaining: 3,
    exhausted: false,
  })
  const [pricingPolicy, setPricingPolicy] = useState({
    guestServiceFeePercent: 5,
    hostCommissionPercent: 0,
    insuranceFundPercent: 0.5,
    chatInvoiceRateMultiplier: 1.025,
  })
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    basePriceThb: '',
    baseCurrency: 'THB',
    district: '',
    latitude: '',
    longitude: '',
    images: [],
    coverIndex: 0,
    metadata: {},
  })
  

  useEffect(() => {
    if (!authLoading && listingId) {
      if (isAuthenticated) {
        loadListing()
      } else {
        setLoading(false)
      }
    }
  }, [authLoading, isAuthenticated, listingId])

  // Listen for auth changes
  useEffect(() => {
    const handleAuthChange = () => {
      if (user?.id && listingId && !listing) {
        loadListing()
      }
    }
    window.addEventListener('auth-change', handleAuthChange)
    return () => window.removeEventListener('auth-change', handleAuthChange)
  }, [user, listingId, listing])

  // After publish from wizard: scroll to calendar block
  useEffect(() => {
    if (typeof window === 'undefined' || !listing) return
    const sp = new URLSearchParams(window.location.search)
    if (sp.get('highlight') !== 'calendar') return
    const timer = setTimeout(() => {
      document.getElementById('partner-calendar-sync')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      toast.success(getUIText('partnerCal_toastScroll', language))
      window.history.replaceState({}, '', window.location.pathname)
    }, 600)
    return () => clearTimeout(timer)
  }, [listing, language])

  async function refreshAiDescriptionQuota() {
    if (!listingId) return
    try {
      const res = await fetch(
        `/api/v2/partner/listings/generate-description?listingId=${encodeURIComponent(listingId)}`,
        { credentials: 'include' },
      )
      const j = await res.json()
      if (j.success && j.data) setAiDescQuota(j.data)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    if (listing) refreshAiDescriptionQuota()
  }, [listing, listingId])

  useEffect(() => {
    if (!user?.id) return
    ;(async () => {
      try {
        const res = await fetch(`/api/v2/commission?partnerId=${encodeURIComponent(String(user.id))}`, {
          credentials: 'include',
        })
        const json = await res.json()
        if (json.success && json.data) {
          setPricingPolicy((prev) => ({
            ...prev,
            guestServiceFeePercent: Number.isFinite(Number(json.data.guestServiceFeePercent))
              ? Number(json.data.guestServiceFeePercent)
              : prev.guestServiceFeePercent,
            hostCommissionPercent: Number.isFinite(Number(json.data.hostCommissionPercent))
              ? Number(json.data.hostCommissionPercent)
              : prev.hostCommissionPercent,
            insuranceFundPercent: Number.isFinite(Number(json.data.insuranceFundPercent))
              ? Number(json.data.insuranceFundPercent)
              : prev.insuranceFundPercent,
            chatInvoiceRateMultiplier: Number.isFinite(Number(json.data.chatInvoiceRateMultiplier))
              ? Number(json.data.chatInvoiceRateMultiplier)
              : prev.chatInvoiceRateMultiplier,
          }))
        }
      } catch {
        // noop
      }
    })()
  }, [user?.id])

  async function loadListing() {
    try {
      // Use server API that bypasses RLS
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        credentials: 'include'
      })
      const result = await res.json()
      
      console.log('[EDIT] API response:', result)
      
      if (result.success && (result.data || result.listing)) {
        const l = result.data || result.listing
        setListing(l)
        
        // Find cover index
        const images = l.images || []
        const coverIndex = l.coverImage ? images.findIndex(img => img === l.coverImage) : 0
        
        const rawMeta = l.metadata && typeof l.metadata === 'object' ? { ...l.metadata } : {}
        const shaped = partnerMetadataStateFromServer(rawMeta)
        const catSlug = l.category?.slug ?? ''
        let metadataLoaded = {
          ...shaped,
          amenities: filterAmenitiesForPartnerCategory(
            catSlug,
            normalizeWizardAmenities(rawMeta.amenities || []),
          ),
        }
        if (isTourListingCategory(catSlug)) {
          delete metadataLoaded.discounts
          metadataLoaded = mergeTourGroupMetadataFromListingColumns(
            metadataLoaded,
            l.min_booking_days ?? l.minBookingDays,
            l.max_booking_days ?? l.maxBookingDays,
          )
        }
        setFormData({
          title: l.title || '',
          description: pickPartnerFormDescription(language, l.description || '', rawMeta),
          basePriceThb: sanitizeThbDigits((l.basePriceThb ?? l.base_price_thb)?.toString() || '') || '',
          baseCurrency: l.baseCurrency || l.base_currency || rawMeta.base_currency || 'THB',
          district: l.district || '',
          latitude: l.latitude != null && l.latitude !== '' ? String(l.latitude) : '',
          longitude: l.longitude != null && l.longitude !== '' ? String(l.longitude) : '',
          images: images,
          coverIndex: coverIndex >= 0 ? coverIndex : 0,
          metadata: metadataLoaded,
        })
        
        // Seasonal prices loaded by SeasonalPriceManager from API
      } else {
        console.error('[EDIT] Failed to load:', result.error)
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listing:', error)
      setLoading(false)
      toast.error(t('partnerEdit_loadErr'))
    }
  }

  function updateDescription(value) {
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
          listingId,
          title: formData.title.trim(),
          district: formData.district || '',
          categorySlug: listing?.category?.slug || '',
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
        toast.error(data.error || t('partnerEdit_listingSaveErr'))
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
        language === 'ru' ? 'Описание и SEO (RU, EN, ZH, TH)' : 'Descriptions & SEO (4 languages)',
      )
    } catch (e) {
      console.error(e)
      toast.error(t('partnerEdit_listingSaveErr'))
    } finally {
      setAiDescriptionLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    
    try {
      const coverImage = formData.images[formData.coverIndex] || formData.images[0] || null
      const categorySlug = listing?.category?.slug ?? ''
      const descTranslations = mergeDescriptionTranslationsForSave(formData, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...formData, metadata: { ...formData.metadata, description_translations: descTranslations } },
        language,
      )
      const metadata =
        formData.metadata && typeof formData.metadata === 'object'
          ? normalizePartnerListingMetadata(
              { ...formData.metadata, description_translations: descTranslations },
              categorySlug,
            )
          : undefined

      const tourBd =
        categorySlug && isTourListingCategory(categorySlug)
          ? { minBookingDays: 1, maxBookingDays: 730 }
          : {}

      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: descriptionDb,
          basePriceThb: parseFloat(formData.basePriceThb) || 0,
          baseCurrency: formData.baseCurrency || 'THB',
          district: formData.district,
          latitude: formData.latitude === '' ? null : parseFloat(formData.latitude),
          longitude: formData.longitude === '' ? null : parseFloat(formData.longitude),
          images: formData.images,
          coverImage: coverImage,
          metadata,
          ...tourBd,
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        toast.success(t('partnerEdit_listingSaved'), { id: 'partner-listing-save' })
        setListing((prev) =>
          prev
            ? {
                ...prev,
                title: formData.title,
                description: descriptionDb,
                latitude: formData.latitude === '' ? null : parseFloat(formData.latitude),
                longitude: formData.longitude === '' ? null : parseFloat(formData.longitude),
              }
            : prev
        )
        const prevCoverIdx = Math.min(
          Math.max(0, formData.coverIndex),
          Math.max(0, formData.images.length - 1)
        )
        const mig = await migrateExternalImagesAfterSave(listingId, formData.images)
        if (mig?.images?.length) {
          const newCover =
            mig.images[Math.min(prevCoverIdx, mig.images.length - 1)] || mig.images[0]
          await patchPartnerListingCoverImage(listingId, newCover)
          setFormData((fd) => ({
            ...fd,
            images: mig.images,
            coverIndex: Math.min(fd.coverIndex, Math.max(0, mig.images.length - 1)),
          }))
          toast.success(tr('partnerEdit_photosMigrated', { n: mig.migrated ?? 0 }), {
            id: 'partner-listing-migrate-img',
          })
        }
      } else {
        toast.error(result.error || t('partnerEdit_listingSaveErr'))
      }
    } catch (error) {
      console.error('Failed to save listing:', error)
      toast.error(t('partnerEdit_listingSaveErr'))
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    // Validate required fields
    if (!formData.title || !formData.basePriceThb || formData.images.length === 0) {
      toast.error(t('partnerEdit_validationPublish'))
      return
    }
    
    setPublishing(true)
    
    try {
      const coverImage = formData.images[formData.coverIndex] || formData.images[0] || null
      const categorySlug = listing?.category?.slug ?? ''
      const descTranslations = mergeDescriptionTranslationsForSave(formData, language)
      const descriptionDb = buildListingDescriptionForDb(
        { ...formData, metadata: { ...formData.metadata, description_translations: descTranslations } },
        language,
      )
      const mergedMeta = {
        ...(listing?.metadata || {}),
        ...(formData.metadata && typeof formData.metadata === 'object' ? formData.metadata : {}),
        description_translations: descTranslations,
        is_draft: false,
        published_at: new Date().toISOString(),
        ...(listing?.metadata?.source === 'TELEGRAM_LAZY_REALTOR'
          ? { submitted_from: 'telegram' }
          : {}),
      }

      const tourBd =
        categorySlug && isTourListingCategory(categorySlug)
          ? { minBookingDays: 1, maxBookingDays: 730 }
          : {}

      // Save and change status to PENDING
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: descriptionDb,
          basePriceThb: parseFloat(formData.basePriceThb) || 0,
          baseCurrency: formData.baseCurrency || 'THB',
          district: formData.district,
          latitude: formData.latitude === '' ? null : parseFloat(formData.latitude),
          longitude: formData.longitude === '' ? null : parseFloat(formData.longitude),
          images: formData.images,
          coverImage: coverImage,
          status: 'PENDING',
          metadata: normalizePartnerListingMetadata(mergedMeta, categorySlug),
          ...tourBd,
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        const prevCoverIdx = Math.min(
          Math.max(0, formData.coverIndex),
          Math.max(0, formData.images.length - 1)
        )
        const mig = await migrateExternalImagesAfterSave(listingId, formData.images)
        if (mig?.images?.length) {
          const newCover =
            mig.images[Math.min(prevCoverIdx, mig.images.length - 1)] || mig.images[0]
          await patchPartnerListingCoverImage(listingId, newCover)
        }
        toast.success(t('partnerEdit_listingPublished'))
        router.push('/partner/listings')
      } else {
        toast.error(result.error || t('partnerEdit_listingPublishErr'))
      }
    } catch (error) {
      console.error('Failed to publish:', error)
      toast.error(t('partnerEdit_listingPublishErr'))
    } finally {
      setPublishing(false)
    }
  }

  // File upload with compression and Supabase Storage
  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    setUploading(true)
    setUploadProgress(0)
    
    const newImages = [...formData.images]
    
    try {
      // Dynamically import the image upload service
      const { processAndUploadImages } = await import('@/lib/services/image-upload.service')
      
      // Process and upload images with compression
      const uploadedUrls = await processAndUploadImages(files, listingId, (progress) => {
        setUploadProgress(progress)
      })
      
      // Add new URLs to images array
      for (const url of uploadedUrls) {
        newImages.push(url)
      }
      
      setFormData({ ...formData, images: newImages })
      
      if (uploadedUrls.length > 0) {
        toast.success(tr('partnerEdit_photoUploadedN', { n: uploadedUrls.length }))
      }

      if (uploadedUrls.length < files.length) {
        toast.warning(tr('partnerEdit_photoPartialFail', { n: files.length - uploadedUrls.length }))
      }
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(t('partnerEdit_imageUploadErr'))
    }
    
    setUploading(false)
    setTimeout(() => setUploadProgress(0), 1500)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function removeImage(index) {
    const imageUrl = formData.images[index]
    
    // Try to delete from Supabase Storage if it's a storage URL
    if (typeof imageUrl === 'string' && (imageUrl.includes('/listing-images/') || imageUrl.includes('supabase.co/storage'))) {
      try {
        const { deleteFromStorage } = await import('@/lib/services/image-upload.service')
        await deleteFromStorage(imageUrl)
      } catch (error) {
        console.error('Failed to delete from storage:', error)
      }
    }
    
    const newImages = formData.images.filter((_, i) => i !== index)
    let newCoverIndex = formData.coverIndex
    
    // Adjust cover index if needed
    if (index === formData.coverIndex) {
      newCoverIndex = 0
    } else if (index < formData.coverIndex) {
      newCoverIndex = formData.coverIndex - 1
    }
    
    setFormData({ 
      ...formData, 
      images: newImages,
      coverIndex: Math.max(0, newCoverIndex)
    })
    toast.success(t('partnerEdit_photoRemoved'))
  }

  function setAsCover(index) {
    setFormData({ ...formData, coverIndex: index })
    toast.success(t('partnerEdit_coverSet'))
  }

  function updateDurationDiscountPercent(field, raw) {
    setFormData((fd) => {
      const meta = fd.metadata && typeof fd.metadata === 'object' ? { ...fd.metadata } : {}
      const { metadata, warnOrder } = applyDurationDiscountField(meta, field, raw)
      if (warnOrder) {
        queueMicrotask(() => toast.warning(t('partnerDurationDiscountOrderWarning')))
      }
      return { ...fd, metadata }
    })
  }

  // Check if can publish
  const canPublish =
    !!formData.title &&
    parseFloat(String(formData.basePriceThb).replace(',', '.')) > 0 &&
    formData.images.length > 0
  const isDraft = listing?.metadata?.is_draft
  const pricingPreview = (() => {
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
  })()

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  // Not authenticated - show login prompt
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="h-8 w-8 text-slate-400" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{t('partnerEdit_loginTitle')}</h2>
        <p className="text-slate-500 text-center mb-6">{t('partnerEdit_loginSubtitle')}</p>
        <Button
          onClick={() => {
            // Use auth context openLoginModal if available
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('open-login-modal', { detail: { mode: 'login' } }))
            }
          }}
          className="bg-teal-600 hover:bg-teal-700"
        >
          {t('partnerEdit_loginCta')}
        </Button>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600 mb-4">{t('partnerEdit_notFound')}</p>
        <Button asChild className="bg-teal-600 hover:bg-teal-700">
          <Link href="/partner/listings">{t('partnerEdit_backToListings')}</Link>
        </Button>
      </div>
    )
  }

  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    INACTIVE: 'bg-slate-100 text-slate-700',
  }

  const categorySlug = listing?.category?.slug ?? ''
  const toursCategory = isTourListingCategory(categorySlug)
  const hideAirbnbImportBlock = isTransportListingCategory(categorySlug) || toursCategory
  const partnerAmenitySlugs = amenitySlugsForPartnerCategory(categorySlug)
  const showExternalCalendarSync = !isTransportListingCategory(categorySlug)
  const vehicleRentalDayCopy = isTransportListingCategory(categorySlug)
  const amenitiesHintKey = vehicleRentalDayCopy
    ? 'partnerEdit_amenitiesHintVehicle'
    : toursCategory
      ? 'partnerEdit_amenitiesHintTour'
      : 'partnerEdit_amenitiesHint'
  const basePriceLabelKey = vehicleRentalDayCopy
    ? 'basePriceVehicle'
    : toursCategory
      ? 'basePriceTour'
      : 'basePrice'
  const basePricePlaceholderKey = toursCategory ? 'basePriceTourPlaceholder' : 'basePricePlaceholder'

  const searchMetadataFields =
    listing?.category?.slug != null && listing.category.slug !== '' ? (
      <PartnerListingSearchMetadataFields
        categorySlug={listing.category.slug}
        categoryNameFallback={listing.category?.name}
        language={language}
        metadata={formData.metadata}
        updateMetadata={(field, value) =>
          setFormData((fd) => ({
            ...fd,
            metadata: { ...fd.metadata, [field]: value },
          }))
        }
        variant="edit"
        showWizardExtraHousingFields={false}
      />
    ) : null

  return (
    <div className="min-h-screen bg-slate-50 pb-24 lg:pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-3 py-3 lg:px-4 lg:py-4">
          <div className="flex items-center gap-2 lg:gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base lg:text-2xl font-bold text-slate-900 truncate">
                {isDraft ? t('partnerEdit_fillDraft') : t('partnerEdit_editTitle')}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={`text-xs ${isDraft ? 'bg-amber-100 text-amber-700 border-amber-300' : statusColors[listing.status]}`}>
                  {isDraft
                    ? t('partnerEdit_statusDraft')
                    : listing.status === 'ACTIVE'
                      ? t('partnerEdit_statusActive')
                      : listing.status === 'PENDING'
                        ? t('partnerEdit_statusPending')
                        : t('partnerEdit_statusInactive')}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                onClick={handleSave}
                disabled={saving || publishing}
                variant="outline"
                size="sm"
                className="hidden lg:flex"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                {t('partnerEdit_save')}
              </Button>
              {isDraft && (
                <Button
                  onClick={handlePublish}
                  disabled={!canPublish || saving || publishing}
                  className="bg-teal-600 hover:bg-teal-700"
                  size="sm"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 lg:mr-2" />}
                  <span className="hidden lg:inline">{t('partnerEdit_publish')}</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl space-y-5 px-3 py-5 sm:px-4 lg:space-y-8 lg:py-8">
        
        {/* Basic Info - Mobile Optimized */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 lg:pb-4">
            <CardTitle className="text-base font-semibold tracking-tight lg:text-lg">
              {t('partnerEdit_basicInfo')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {listing?.categoryId && !hideAirbnbImportBlock && (
              <PartnerListingImportBlock
                categoryId={listing.categoryId}
                variant="edit"
                listingId={listingId}
                migrateImportedImagesToStorage
                onApplyPreview={(preview) => {
                  setFormData((prev) => {
                    const { nextFormData } = mergeAirbnbPreviewEdit(prev, preview)
                    const slug = listing?.category?.slug ?? ''
                    return {
                      ...nextFormData,
                      basePriceThb: sanitizeThbDigits(nextFormData.basePriceThb || ''),
                      metadata: {
                        ...nextFormData.metadata,
                        amenities: filterAmenitiesForPartnerCategory(
                          slug,
                          normalizeWizardAmenities(nextFormData.metadata?.amenities || []),
                        ),
                      },
                    }
                  })
                }}
              />
            )}

            {vehicleRentalDayCopy && searchMetadataFields}

            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm font-medium text-slate-800">
                {t('partnerEdit_listingTitle')}
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder={t('partnerEdit_titlePh')}
                className="h-11 text-base"
              />
            </div>

            <div className="space-y-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <Label htmlFor="description" className="text-sm font-medium text-slate-800">
                  {t('partnerEdit_listingDesc')}
                </Label>
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
              <p className="text-xs text-slate-500">{t('improveDescriptionAIHint')}</p>
              <p className="mt-1 text-xs text-slate-600">
                {t('improveDescriptionAIQuotaUsed')
                  .replace('{{used}}', String(aiDescQuota.used))
                  .replace('{{limit}}', String(aiDescQuota.limit))}
              </p>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => updateDescription(e.target.value)}
                rows={5}
                className="min-h-[120px] text-base"
                placeholder={t('partnerEdit_descPh')}
              />
            </div>

            {!vehicleRentalDayCopy && searchMetadataFields}

            <div className="space-y-3">
              <Label className="text-sm font-medium text-slate-800">{t('amenities')}</Label>
              <p className="text-xs leading-relaxed text-slate-500">{t(amenitiesHintKey)}</p>
              {partnerAmenitySlugs.length === 0 ? (
                <p className="text-sm text-slate-500">{t('notSet')}</p>
              ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                {partnerAmenitySlugs.map((slug) => {
                  const selected =
                    Array.isArray(formData.metadata?.amenities) && formData.metadata.amenities.includes(slug)
                  return (
                    <Button
                      key={slug}
                      type="button"
                      variant={selected ? 'default' : 'outline'}
                      size="sm"
                      className={`h-auto min-h-10 whitespace-normal px-3 py-2 text-center text-sm leading-snug ${
                        selected ? 'bg-teal-600 hover:bg-teal-700' : ''
                      }`}
                      onClick={() => {
                        setFormData((fd) => {
                          const cur = Array.isArray(fd.metadata?.amenities) ? fd.metadata.amenities : []
                          const updated = selected ? cur.filter((a) => a !== slug) : [...cur, slug]
                          return {
                            ...fd,
                            metadata: { ...fd.metadata, amenities: updated },
                          }
                        })
                      }}
                    >
                      {getAmenityName(slug, language, slug)}
                    </Button>
                  )
                })}
              </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-5 sm:gap-6">
              <div className="space-y-2 min-w-0">
                <Label htmlFor="price" className="text-sm font-medium text-slate-800">
                  {t(basePriceLabelKey)}
                </Label>
                <Input
                  id="price"
                  inputMode="numeric"
                  autoComplete="off"
                  value={formData.basePriceThb}
                  onChange={(e) =>
                    setFormData({ ...formData, basePriceThb: sanitizeThbDigits(e.target.value) })
                  }
                  placeholder={t(basePricePlaceholderKey)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2 min-w-0">
                <Label className="text-sm font-medium text-slate-800">Базовая валюта листинга</Label>
                <Select
                  value={formData.baseCurrency || 'THB'}
                  onValueChange={(value) => setFormData((fd) => ({ ...fd, baseCurrency: value }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="THB">THB (Thai Baht)</SelectItem>
                    <SelectItem value="RUB">RUB (Russian Ruble)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="USDT">USDT (Tether)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 min-w-0">
                <Label htmlFor="district" className="text-sm font-medium text-slate-800">
                  {t('selectDistrict').replace(' *', '')}
                </Label>
                <Input
                  id="district"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  placeholder={t('selectDistrictPlaceholder')}
                  className="h-11"
                />
              </div>
            </div>
            <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3">
              <p className="text-sm font-semibold text-sky-900">Ориентировочная цена на сайте</p>
              <p className="mt-1 text-xl font-bold text-sky-800">
                ฿{pricingPreview.sitePriceSameCurrency.toLocaleString('ru-RU')}
              </p>
              <p className="mt-2 text-xs text-sky-900">
                База: ฿{pricingPreview.base.toLocaleString('ru-RU')} + сервисный сбор гостя ({pricingPreview.guestFeePercent}%):
                {' '}฿{pricingPreview.guestFeeThb.toLocaleString('ru-RU')}
              </p>
              <p className="mt-1 text-xs text-sky-900">
                Если гость платит в другой валюте: возможна доп. наценка за эквайринг/FX +{pricingPreview.markupPercent.toFixed(2)}%
                {' '}→ ориентир ฿{pricingPreview.sitePriceCrossCurrency.toLocaleString('ru-RU')}
              </p>
            </div>

            {toursCategory ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="tourGroupMin" className="text-sm font-medium text-slate-800">
                      {t('minStayTourGroup')}
                    </Label>
                    <Input
                      id="tourGroupMin"
                      inputMode="numeric"
                      autoComplete="off"
                      value={String(formData.metadata?.group_size_min ?? 1)}
                      onChange={(e) => {
                        const v = clampIntFromDigits(e.target.value, 1, 999, 1)
                        setFormData((fd) => {
                          const meta = { ...(fd.metadata || {}) }
                          const curMax = clampIntFromDigits(
                            meta.group_size_max ?? v,
                            1,
                            999,
                            Math.max(v, 10),
                          )
                          meta.group_size_min = v
                          if (curMax < v) meta.group_size_max = v
                          return { ...fd, metadata: meta }
                        })
                      }}
                      className="h-11"
                    />
                  </div>
                  <div className="space-y-2 min-w-0">
                    <Label htmlFor="tourGroupMax" className="text-sm font-medium text-slate-800">
                      {t('maxStayTourGroup')}
                    </Label>
                    <Input
                      id="tourGroupMax"
                      inputMode="numeric"
                      autoComplete="off"
                      value={String(
                        formData.metadata?.group_size_max ??
                          Math.max(formData.metadata?.group_size_min ?? 1, 10),
                      )}
                      onChange={(e) => {
                        setFormData((fd) => {
                          const meta = { ...(fd.metadata || {}) }
                          const gmin = clampIntFromDigits(meta.group_size_min ?? 1, 1, 999, 1)
                          const raw = clampIntFromDigits(e.target.value, 1, 999, Math.max(gmin, 10))
                          meta.group_size_max = Math.max(gmin, raw)
                          return { ...fd, metadata: meta }
                        })
                      }}
                      className="h-11"
                    />
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                  {t('partnerTourMinMaxBackendHint')}
                </p>
              </div>
            ) : null}

            {!toursCategory ? (
              <PartnerListingDurationDiscountFields
                metadata={formData.metadata}
                language={language}
                onChangeDiscount={updateDurationDiscountPercent}
                rentalPeriodDays={vehicleRentalDayCopy}
              />
            ) : null}

            <div className="space-y-3 border-t border-slate-100 pt-5">
              <Label className="text-sm font-medium text-slate-800">{t('partnerEdit_mapSection')}</Label>
              <p className="text-xs leading-relaxed text-slate-500">{t('partnerEdit_mapHint')}</p>
              <MapPicker
                categoryId={listing?.categoryId}
                categorySlug={listing?.category?.slug}
                language={language}
                latitude={formData.latitude ? parseFloat(formData.latitude) : null}
                longitude={formData.longitude ? parseFloat(formData.longitude) : null}
                height={220}
                onSelect={(lat, lng, geo) => {
                  setFormData((fd) => ({
                    ...fd,
                    latitude: String(lat),
                    longitude: String(lng),
                    district:
                      geo?.district != null && String(geo.district).trim()
                        ? String(geo.district).trim()
                        : fd.district,
                  }))
                }}
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="lat" className="text-xs font-medium text-slate-600">
                    {t('latitude')}
                  </Label>
                  <Input
                    id="lat"
                    inputMode="decimal"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                    placeholder="7.88"
                    className="text-sm font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lng" className="text-xs font-medium text-slate-600">
                    {t('longitude')}
                  </Label>
                  <Input
                    id="lng"
                    inputMode="decimal"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                    placeholder="98.39"
                    className="text-sm font-mono"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media Management - Mobile First */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3 lg:pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 lg:h-10 lg:w-10">
                  <FileImage className="h-4 w-4 text-white lg:h-5 lg:w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold tracking-tight lg:text-lg">
                    {t('partnerEdit_photosTitle')}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {tr('partnerEdit_photosMeta', { n: formData.images.length })}
                  </CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-purple-600">{t('partnerEdit_uploading')}</span>
                  <span className="text-slate-500">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-2" />
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Image Grid */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {formData.images.map((img, index) => (
                <div key={index} className="relative group aspect-video rounded-lg overflow-hidden border-2 border-slate-200">
                  <ProxiedImage
                    src={img}
                    alt={`Image ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 50vw, 33vw"
                  />
                  
                  {/* Cover badge */}
                  {index === formData.coverIndex && (
                    <Badge className="absolute left-2 top-2 bg-teal-600 text-white">
                      <Star className="mr-1 h-3 w-3" />
                      {t('coverBadge')}
                    </Badge>
                  )}
                  
                  {/* Hover controls */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {index !== formData.coverIndex && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setAsCover(index)}
                        className="bg-white/90 hover:bg-white text-xs"
                      >
                        <Star className="mr-1 h-3 w-3" />
                        {t('partnerEdit_setCoverBtn')}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeImage(index)}
                      className="bg-red-500/90 hover:bg-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}

              {/* Upload Button */}
              {formData.images.length < 30 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-video border-2 border-dashed border-slate-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition flex flex-col items-center justify-center gap-1 text-slate-600 hover:text-purple-600 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Upload className="h-6 w-6" />
                  )}
                  <span className="text-xs font-medium">{t('partnerEdit_addPhoto')}</span>
                </button>
              )}
            </div>

            {formData.images.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700">{t('partnerEdit_photoRequired')}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* iCal / OTA sync — не для аренды транспорта (только ручная блокировка в календаре ниже) */}
        {showExternalCalendarSync ? (
          <CalendarSyncManager listingId={listingId} onSync={() => {}} />
        ) : null}

        {/* Manual Availability Calendar */}
        <AvailabilityCalendar 
          listingId={listingId}
          syncErrors={[]}
        />

        {/* Seasonal Pricing - Full SeasonalPriceManager */}
        <SeasonalPriceManager
          listingId={listingId}
          basePriceThb={parseFloat(String(formData.basePriceThb).replace(',', '.')) || 0}
        />

        {/* Action Buttons - Mobile Fixed Footer (extra padding: Android nav bar + breathing room) */}
        <div
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/80 bg-white/95 shadow-[0_-6px_24px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:hidden"
          style={{
            paddingTop: '0.75rem',
            paddingBottom: 'max(1.25rem, calc(env(safe-area-inset-bottom, 0px) + 12px))',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
          }}
        >
          <div className="mx-auto flex max-w-4xl gap-3">
            <Button
              onClick={handleSave}
              disabled={saving || publishing}
              variant="outline"
              className="h-12 flex-1 rounded-xl border-slate-300 text-base font-medium"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  {t('partnerEdit_save')}
                </>
              )}
            </Button>
            {isDraft && (
              <Button
                onClick={handlePublish}
                disabled={!canPublish || saving || publishing}
                className="h-12 flex-1 rounded-xl bg-teal-600 text-base font-medium hover:bg-teal-700"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    {t('partnerEdit_publish')}
                  </>
                )}
              </Button>
            )}
          </div>
          {isDraft && !canPublish && (
            <p className="mt-3 text-center text-xs leading-relaxed text-amber-600">
              {t('partnerEdit_publishFooterHint')}
            </p>
          )}
        </div>
        
        {/* Spacer for fixed footer on mobile */}
        <div className="h-28 lg:hidden" />
      </div>
    </div>
  )
}
