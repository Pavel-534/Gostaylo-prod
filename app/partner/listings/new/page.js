'use client'

/**
 * Gostaylo Premium Multi-step Listing Wizard v2
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
import { getUIText } from '@/lib/translations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft, ArrowRight, Save, CheckCircle2, 
  Home, Bike, Anchor, Map as MapIcon, DollarSign, 
  ImageIcon, Building, Users, Bed, Bath, Loader2
} from 'lucide-react'
import { ProxiedImage } from '@/components/proxied-image'
import { toast } from 'sonner'
import { GostayloListingCard } from '@/components/gostaylo-listing-card'
import { PartnerCalendarEducationCard } from '@/components/partner/PartnerCalendarEducationCard'
import dynamic from 'next/dynamic'
import { DayPicker } from 'react-day-picker'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { getSeasonColor } from '@/lib/price-calculator'
import 'react-day-picker/dist/style.css'

const MapPicker = dynamic(() => import('@/components/listing/MapPicker'), { ssr: false })

const SEASON_TYPES = [
  { value: 'LOW', label: 'Низкий', color: 'green' },
  { value: 'NORMAL', label: 'Обычный', color: 'slate' },
  { value: 'HIGH', label: 'Высокий', color: 'orange' },
  { value: 'PEAK', label: 'Пик', color: 'red' },
]

const DISTRICTS = [
  'Rawai', 'Chalong', 'Kata', 'Karon', 'Patong', 'Kamala', 
  'Surin', 'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang'
]

const AMENITIES = [
  'Wi-Fi', 'Pool', 'Parking', 'AC', 'Kitchen', 'Laundry',
  'Security', 'Garden', 'Terrace', 'BBQ', 'Gym', 'Sauna'
]

export default function PremiumListingWizard() {
  const router = useRouter()
  const { language } = useI18n()
  const t = (key) => getUIText(key, language)
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
  const [partnerCommissionRate, setPartnerCommissionRate] = useState(15) // Dynamic from DB
  
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
    commissionRate: 15, // Will be dynamically loaded from partner profile
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
      includes: []
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
            const rate = commissionData.data.effectiveRate ?? commissionData.data.systemRate ?? 15
            setPartnerCommissionRate(rate)
            setFormData(prev => ({ ...prev, commissionRate: rate }))
          }
        }
        
        // Load existing listing if edit mode
        if (isEditMode && editId) {
          await loadExistingListing(editId)
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
      }
    }
    loadInitialData()
  }, [])
  
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
        setFormData({
          categoryId: listing.categoryId || listing.category_id || '',
          categoryName: cat?.name || '',
          title: listing.title || '',
          description: listing.description || '',
          district: listing.district || '',
          latitude: listing.latitude ?? null,
          longitude: listing.longitude ?? null,
          basePriceThb: (listing.basePriceThb ?? listing.base_price_thb)?.toString() || '',
          commissionRate: listing.commissionRate ?? listing.commission_rate ?? partnerCommissionRate,
          minBookingDays: listing.minBookingDays ?? listing.min_booking_days ?? 1,
          maxBookingDays: listing.maxBookingDays ?? listing.max_booking_days ?? 90,
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
            ...(listing.metadata || {})
          },
          seasonalPricing: seasonal || listing.seasonalPricing || listing.seasonalPrices || []
        })
      }
    } catch (error) {
      console.error('Failed to load listing:', error)
      toast.error(t('failedToLoadListing'))
    } finally {
      setLoading(false)
    }
  }
  
  // Progress calculation
  const progress = useMemo(() => {
    return ((currentStep - 1) / (STEPS.length - 1)) * 100
  }, [currentStep])
  
  // Update form field
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
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
        toast.success(`+${newUrls.length} ${language === 'ru' ? 'фото загружено' : 'photos uploaded'}`)
      }
    } catch (e) {
      console.error(e)
      toast.error(language === 'ru' ? 'Ошибка загрузки' : 'Upload failed')
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
        toast.error(language === 'ru' ? 'Ничего не найдено' : 'No results found')
      }
    } catch (e) {
      toast.error(language === 'ru' ? 'Ошибка поиска' : 'Search failed')
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
        return formData.basePriceThb > 0
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
      
      if (isEditMode && editId) {
        // Update existing draft/listing
        const payload = {
          ...formData,
          status: formData.status || 'INACTIVE',
          available: false,
          basePriceThb: parseFloat(formData.basePriceThb) || 0,
          images: formData.images,
          metadata: { ...formData.metadata, is_draft: true }
        }
        const res = await fetch(`/api/v2/partner/listings/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        })
        const data = await res.json()
        if (data.success) {
          toast.success(t('draftSaved'))
          router.push('/partner/listings')
        } else {
          toast.error(data.error || t('failedToLoadListing'))
        }
      } else {
        // Create new draft
        const payload = {
          ownerId: userId,
          categoryId: formData.categoryId,
          title: formData.title || 'Черновик',
          description: formData.description || '',
          district: formData.district || '',
          basePriceThb: parseFloat(formData.basePriceThb) || 0,
          images: formData.images || [],
          metadata: { ...formData.metadata, is_draft: true },
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
          toast.success(t('draftSaved'))
          router.push('/partner/listings')
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
      
      const payload = {
        ...formData,
        ownerId: userId,
        status: 'PENDING',
        available: true,
        basePriceThb: parseFloat(formData.basePriceThb) || 0,
        commissionRate: parseFloat(formData.commissionRate) || 15,
        minBookingDays: parseInt(formData.minBookingDays) || 1,
        maxBookingDays: parseInt(formData.maxBookingDays) || 90,
        metadata: { ...formData.metadata, is_draft: false }
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
    
    if (categoryName.includes('villa') || categoryName.includes('property')) {
      return (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bedrooms</Label>
              <Input
                type="number"
                min="0"
                value={formData.metadata.bedrooms}
                onChange={(e) => updateMetadata('bedrooms', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Bathrooms</Label>
              <Input
                type="number"
                min="0"
                value={formData.metadata.bathrooms}
                onChange={(e) => updateMetadata('bathrooms', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Max Guests</Label>
              <Input
                type="number"
                min="1"
                value={formData.metadata.max_guests}
                onChange={(e) => updateMetadata('max_guests', parseInt(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Area (m²)</Label>
              <Input
                type="number"
                min="0"
                value={formData.metadata.area}
                onChange={(e) => updateMetadata('area', parseInt(e.target.value) || 0)}
                className="mt-1"
              />
            </div>
          </div>
        </>
      )
    } else if (categoryName.includes('yacht') || categoryName.includes('boat')) {
      return (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Passengers</Label>
              <Input
                type="number"
                min="1"
                value={formData.metadata.passengers}
                onChange={(e) => updateMetadata('passengers', parseInt(e.target.value) || 1)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Engine Type</Label>
              <Input
                type="text"
                placeholder="e.g., 2x 300HP"
                value={formData.metadata.engine}
                onChange={(e) => updateMetadata('engine', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </>
      )
    } else if (categoryName.includes('tour')) {
      return (
        <>
          <div>
            <Label>Duration</Label>
            <Input
              type="text"
              placeholder="e.g., 4 hours"
              value={formData.metadata.duration}
              onChange={(e) => updateMetadata('duration', e.target.value)}
              className="mt-1"
            />
          </div>
        </>
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
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-base font-medium">Title *</Label>
              <Input
                type="text"
                placeholder={t('titlePlaceholder')}
                value={formData.title}
                onChange={(e) => updateField('title', e.target.value)}
                className="mt-2 h-12"
                maxLength={100}
              />
              <p className="text-xs text-slate-500 mt-1">{formData.title.length}/100 {t('characters')}</p>
            </div>
            
            <div>
              <Label className="text-base font-medium">Description *</Label>
              <Textarea
                placeholder={t('descriptionPlaceholder')}
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className="mt-2 min-h-[120px]"
                maxLength={2000}
              />
              <p className="text-xs text-slate-500 mt-1">{formData.description.length}/2000 {t('characters')}</p>
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
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{t('listingSpecs')}</h2>
              <p className="text-slate-600">{t('addDetailsFor')} {formData.categoryName || ''}.</p>
            </div>
            
            {renderSpecs()}
            
            <div>
              <Label className="text-base font-medium">{t('amenities')}</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {AMENITIES.map(amenity => {
                  const selected = formData.metadata.amenities?.includes(amenity)
                  return (
                    <Button
                      key={amenity}
                      variant={selected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        const current = formData.metadata.amenities || []
                        const updated = selected 
                          ? current.filter(a => a !== amenity)
                          : [...current, amenity]
                        updateMetadata('amenities', updated)
                      }}
                      className={selected ? 'bg-teal-600 hover:bg-teal-700' : ''}
                    >
                      {amenity}
                    </Button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      
      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2">{t('pricingAndBooking')}</h2>
              <p className="text-slate-600">{t('setRates')}</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-base font-medium">{t('basePrice')}</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder={t('basePricePlaceholder')}
                  value={formData.basePriceThb}
                  onChange={(e) => updateField('basePriceThb', e.target.value)}
                  className="mt-2 h-12"
                />
              </div>
              <div className="flex flex-col justify-end">
                <p className="text-sm font-medium text-slate-700">
                  {language === 'ru' ? 'Комиссия системы' : 'System commission'}
                </p>
                <p className="text-lg font-semibold text-teal-600 mt-1">
                  {partnerCommissionRate}%
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {partnerCommissionRate !== 15 
                    ? (language === 'ru' ? 'Индивидуальная ставка для партнёра' : 'Personal partner rate')
                    : (language === 'ru' ? 'Стандартная ставка' : 'Standard rate')}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-base font-medium">{t('minStay')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.minBookingDays}
                  onChange={(e) => updateField('minBookingDays', e.target.value)}
                  className="mt-2 h-12"
                />
              </div>
              <div>
                <Label className="text-base font-medium">{t('maxStay')}</Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.maxBookingDays}
                  onChange={(e) => updateField('maxBookingDays', e.target.value)}
                  className="mt-2 h-12"
                />
              </div>
            </div>
            
            <div>
              <Label className="text-base font-medium">{t('seasonalPricing')}</Label>
              <p className="text-xs text-slate-500 mt-1">{t('seasonalPricingDesc')}</p>
              <div className="mt-2 space-y-4">
                <div className="border rounded-lg p-4 bg-slate-50">
                  <Label className="text-sm font-medium mb-2 block">Диапазон дат</Label>
                  <DayPicker
                    mode="range"
                    selected={newSeason.dateRange}
                    onSelect={(range) => setNewSeason(s => ({ ...s, dateRange: range || { from: null, to: null } }))}
                    locale={ru}
                    className="mx-auto"
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">{t('seasonLabel')}</Label>
                    <Input
                      placeholder="Высокий сезон"
                      value={newSeason.label}
                      onChange={(e) => setNewSeason(s => ({ ...s, label: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Тип</Label>
                    <Select value={newSeason.seasonType} onValueChange={(v) => setNewSeason(s => ({ ...s, seasonType: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SEASON_TYPES.map(st => (
                          <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">฿/день</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="15000"
                      value={newSeason.priceDaily}
                      onChange={(e) => setNewSeason(s => ({ ...s, priceDaily: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">฿/мес (опц.)</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="—"
                      value={newSeason.priceMonthly}
                      onChange={(e) => setNewSeason(s => ({ ...s, priceMonthly: e.target.value }))}
                    />
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const from = newSeason.dateRange?.from
                    const to = newSeason.dateRange?.to || newSeason.dateRange?.from
                    if (newSeason.label && from && to && newSeason.priceDaily) {
                      setFormData(prev => ({
                        ...prev,
                        seasonalPricing: [...(prev.seasonalPricing || []), {
                          id: `s-${Date.now()}`,
                          label: newSeason.label,
                          startDate: format(from, 'yyyy-MM-dd'),
                          endDate: format(to, 'yyyy-MM-dd'),
                          priceDaily: parseFloat(newSeason.priceDaily) || 0,
                          priceMonthly: newSeason.priceMonthly ? parseFloat(newSeason.priceMonthly) : null,
                          seasonType: newSeason.seasonType
                        }]
                      }))
                      setNewSeason({ label: '', dateRange: { from: null, to: null }, priceDaily: '', priceMonthly: '', seasonType: 'NORMAL' })
                      toast.success(language === 'ru' ? 'Сезон добавлен' : 'Season added')
                    } else {
                      toast.error(language === 'ru' ? 'Заполните все поля и выберите даты' : 'Fill all fields and select dates')
                    }
                  }}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  {t('addSeason')}
                </Button>
                {(formData.seasonalPricing || []).length > 0 && (
                  <div className="space-y-2 mt-3">
                    {formData.seasonalPricing.map((s, i) => {
                      const colors = getSeasonColor(s.seasonType || 'NORMAL')
                      return (
                        <div key={s.id || i} className={`flex items-center justify-between py-2 px-3 rounded-lg border ${colors.bg} ${colors.border}`}>
                          <span className="text-sm">
                            {s.label} ({s.seasonType || 'NORMAL'}): {s.startDate} — {s.endDate} • ฿{s.priceDaily}/день
                            {s.priceMonthly && ` • ฿${s.priceMonthly}/мес`}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setFormData(prev => ({
                              ...prev,
                              seasonalPricing: (prev.seasonalPricing || []).filter((_, j) => j !== i)
                            }))}
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
                      <Badge className="absolute top-2 left-2 bg-teal-600">Cover</Badge>
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
              Exit
            </Button>
            
            <h1 className="text-xl font-semibold">{isEditMode ? 'Edit Listing' : 'Create New Listing'}</h1>
            
            <Button
              variant="outline"
              onClick={saveDraft}
              disabled={savingDraft}
              className="gap-2"
            >
              {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
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
            <Card className="border-slate-200">
              <CardContent className="p-8">
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
              <h3 className="text-lg font-semibold mb-4 text-slate-700">{t('livePreview')}</h3>
              <Card className="border-slate-200 bg-white">
                <CardContent className="p-4">
                  <GostayloListingCard
                    listing={{
                      id: 'preview',
                      title: formData.title || 'Your listing title',
                      district: formData.district || 'District',
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
                  
                  <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-600">
                    <p className="font-medium mb-1">This is how guests will see your listing</p>
                    <p>Continue filling the form to see updates in real-time.</p>
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
