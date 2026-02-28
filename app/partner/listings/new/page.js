'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, X, ArrowLeft, ArrowRight, Save, Loader2, Calendar, 
  Image as ImageIcon, CheckCircle2, AlertCircle, Plus, Trash2,
  FileImage, Link2, RefreshCw, Clock
} from 'lucide-react'
import { toast } from 'sonner'

const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'

const DISTRICTS = [
  'Rawai', 'Chalong', 'Kata', 'Karon', 'Patong', 'Kamala', 
  'Surin', 'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang'
]

const AMENITIES = [
  'Wi-Fi', 'Бассейн', 'Парковка', 'Кондиционер', 'Кухня', 'Прачечная',
  'Охрана', 'Сад', 'Терраса', 'Барбекю', 'Тренажёрный зал', 'Сауна'
]

const ICAL_SOURCES = [
  { value: 'Airbnb', label: 'Airbnb', color: 'bg-red-100 text-red-700' },
  { value: 'Booking.com', label: 'Booking.com', color: 'bg-blue-100 text-blue-700' },
  { value: 'VRBO', label: 'VRBO', color: 'bg-purple-100 text-purple-700' },
  { value: 'Google', label: 'Google Calendar', color: 'bg-green-100 text-green-700' },
  { value: 'Other', label: 'Другой', color: 'bg-slate-100 text-slate-700' }
]

function detectICalSource(url) {
  if (!url) return 'Other'
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('airbnb')) return 'Airbnb'
  if (lowerUrl.includes('booking.com')) return 'Booking.com'
  if (lowerUrl.includes('vrbo') || lowerUrl.includes('homeaway')) return 'VRBO'
  if (lowerUrl.includes('google.com')) return 'Google'
  return 'Other'
}

export default function NewListing() {
  const router = useRouter()
  const fileInputRef = useRef(null)
  
  const [loading, setLoading] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const [categories, setCategories] = useState([])
  const [step, setStep] = useState(1)
  
  // Upload state
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [uploadQueue, setUploadQueue] = useState([])
  
  // iCal sources state
  const [icalSources, setIcalSources] = useState([])
  const [newIcalUrl, setNewIcalUrl] = useState('')

  // Form data
  const [formData, setFormData] = useState({
    categoryId: '',
    title: '',
    description: '',
    district: '',
    basePriceThb: '',
    commissionRate: 15,
    images: [],
    metadata: {},
  })

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?select=*&order=name.asc`, {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
      })
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load categories:', error)
      setCategories([
        { id: '1', name: 'Property', slug: 'property' },
        { id: '2', name: 'Tours', slug: 'tours' },
        { id: '3', name: 'Vehicles', slug: 'vehicles' },
        { id: '4', name: 'Yachts', slug: 'yachts' }
      ])
    }
  }

  function handleInputChange(field, value) {
    setFormData({ ...formData, [field]: value })
  }

  function handleMetadataChange(field, value) {
    setFormData({
      ...formData,
      metadata: { ...formData.metadata, [field]: value },
    })
  }

  // Real file upload with compression and Supabase Storage
  async function handleFileSelect(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    setUploading(true)
    setUploadProgress(0)
    
    const newImages = [...formData.images]
    
    // Dynamically import the image upload service
    const { processAndUploadImages } = await import('@/lib/services/image-upload.service')
    
    try {
      // Generate a temporary listing ID for storage organization
      const tempListingId = formData.tempListingId || `temp-${Date.now().toString(36)}`
      if (!formData.tempListingId) {
        setFormData(prev => ({ ...prev, tempListingId }))
      }
      
      // Process and upload images with compression
      const uploadedUrls = await processAndUploadImages(files, tempListingId, (progress) => {
        setUploadProgress(progress)
      })
      
      // Add new URLs to images array
      for (const url of uploadedUrls) {
        newImages.push(url)
      }
      
      setFormData({ ...formData, images: newImages, tempListingId })
      
      if (uploadedUrls.length > 0) {
        toast.success(`✅ Загружено ${uploadedUrls.length} фото (сжато и оптимизировано)`)
      }
      
      if (uploadedUrls.length < files.length) {
        toast.warning(`⚠️ ${files.length - uploadedUrls.length} файлов не удалось загрузить`)
      }
      
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Ошибка загрузки изображений')
    }
    
    setUploading(false)
    
    // Reset progress after a moment
    setTimeout(() => setUploadProgress(0), 1500)
    
    // Clear file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function removeImage(index) {
    const newImages = formData.images.filter((_, i) => i !== index)
    setFormData({ ...formData, images: newImages })
  }

  // iCal source management
  function addIcalSource() {
    if (!newIcalUrl) {
      toast.error('Введите URL календаря')
      return
    }
    
    if (!newIcalUrl.startsWith('http')) {
      toast.error('URL должен начинаться с http:// или https://')
      return
    }
    
    const source = detectICalSource(newIcalUrl)
    const newSource = {
      id: `ical-${Date.now()}`,
      url: newIcalUrl,
      source: source,
      status: 'pending'
    }
    
    setIcalSources([...icalSources, newSource])
    setNewIcalUrl('')
    toast.success(`✅ Добавлен ${source}`)
  }

  function removeIcalSource(id) {
    setIcalSources(icalSources.filter(s => s.id !== id))
  }

  // Create listing
  async function handleSubmit(asDraft = false) {
    if (asDraft) {
      setSavingDraft(true)
    } else {
      setLoading(true)
    }

    try {
      // Get current user
      const storedUser = localStorage.getItem('funnyrent_user')
      const user = storedUser ? JSON.parse(storedUser) : null
      
      if (!user || !user.id) {
        toast.error('Необходимо войти в систему')
        return
      }

      // Prepare images - extract URLs
      const imageUrls = formData.images.map(img => 
        typeof img === 'string' ? img : img.url
      )

      const listingId = `lst-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`
      
      const listingData = {
        id: listingId,
        owner_id: user.id,  // Link to logged-in partner
        category_id: formData.categoryId || '1',
        status: 'PENDING',  // Use PENDING for both (DRAFT not in DB enum yet)
        title: formData.title,
        description: formData.description,
        district: formData.district || 'Phuket',
        base_price_thb: parseFloat(formData.basePriceThb) || 10000,
        commission_rate: parseFloat(formData.commissionRate) || 15,
        images: imageUrls,
        cover_image: imageUrls[0] || null,
        metadata: {
          ...formData.metadata,
          created_via: 'partner_dashboard',
          is_draft: asDraft,  // Track draft status in metadata
          sync_settings: icalSources.map(s => ({  // Store in metadata instead of separate column
            id: s.id,
            url: s.url,
            source: s.source,
            enabled: true,
            added_at: new Date().toISOString()
          })),
          title_translations: {
            ru: formData.title,
            en: formData.title,
            zh: formData.title,
            th: formData.title
          }
        },
        available: !asDraft,  // Drafts are not available
        is_featured: false,
        views: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(listingData)
      })

      if (res.ok) {
        const result = await res.json()
        toast.success(asDraft 
          ? '📝 Черновик сохранён! Вы можете продолжить редактирование позже.'
          : '✅ Листинг успешно создан и отправлен на модерацию!')
        
        // Redirect to listings page
        router.push('/partner/listings')
      } else {
        const error = await res.json()
        console.error('Supabase error:', error)
        toast.error('Ошибка: ' + (error.message || error.details || 'Unknown error'))
      }
    } catch (error) {
      console.error('Failed to create listing:', error)
      toast.error('Ошибка при создании листинга')
    } finally {
      setLoading(false)
      setSavingDraft(false)
    }
  }

  const selectedCategory = categories.find(c => c.id === formData.categoryId)
  
  // Check if step is valid to proceed
  const isStep1Valid = formData.categoryId && formData.title && formData.description && formData.district && formData.basePriceThb
  const isStep3Valid = formData.images.length > 0

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-900">Добавить новый листинг</h1>
          <p className="text-slate-600 text-sm mt-1">
            Заполните информацию о вашем предложении
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 md:gap-4">
        {[
          { num: 1, label: 'Информация' },
          { num: 2, label: 'Детали' },
          { num: 3, label: 'Медиа' }
        ].map((s, i) => (
          <div key={s.num} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all ${
                step >= s.num
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
            </div>
            <span className={`hidden md:block text-sm ${step >= s.num ? 'text-teal-600 font-medium' : 'text-slate-400'}`}>
              {s.label}
            </span>
            {i < 2 && (
              <div className={`w-8 md:w-16 h-1 ${step > s.num ? 'bg-teal-600' : 'bg-slate-200'}`} />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleSubmit(false); }} className="space-y-6">
        {/* Step 1: Basic Info */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Основная информация</CardTitle>
              <CardDescription>
                Выберите категорию и введите базовые данные
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="category">Категория *</Label>
                <Select value={formData.categoryId} onValueChange={(v) => handleInputChange('categoryId', v)}>
                  <SelectTrigger className="w-full" data-testid="category-select">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] min-w-[300px]" position="popper" sideOffset={5}>
                    {categories.length === 0 ? (
                      <SelectItem value="loading" disabled>Загрузка...</SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id} className="py-3">
                          <span className="font-medium">{cat.name}</span>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Название *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="Роскошная вилла с видом на океан"
                  required
                  data-testid="listing-title-input"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Описание *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Подробное описание вашего предложения..."
                  rows={5}
                  required
                  data-testid="listing-description-input"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="district">Район *</Label>
                  <Select value={formData.district} onValueChange={(v) => handleInputChange('district', v)}>
                    <SelectTrigger data-testid="district-select">
                      <SelectValue placeholder="Выберите район" />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      {DISTRICTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Цена (THB/день) *</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.basePriceThb}
                    onChange={(e) => handleInputChange('basePriceThb', e.target.value)}
                    placeholder="15000"
                    required
                    data-testid="listing-price-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission">Комиссия платформы</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="commission"
                    type="number"
                    value={formData.commissionRate}
                    className="w-24"
                    disabled
                  />
                  <span className="text-slate-500">%</span>
                  <Badge variant="outline" className="ml-2">Стандарт</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Category-Specific Fields + iCal */}
        {step === 2 && (
          <>
            {selectedCategory && (
              <Card>
                <CardHeader>
                  <CardTitle>Дополнительная информация</CardTitle>
                  <CardDescription>
                    Специфичные поля для категории: {selectedCategory.name}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Property Fields */}
                  {selectedCategory.slug === 'property' && (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Спальни</Label>
                          <Input
                            type="number"
                            value={formData.metadata.bedrooms || ''}
                            onChange={(e) => handleMetadataChange('bedrooms', parseInt(e.target.value))}
                            placeholder="3"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Ванные</Label>
                          <Input
                            type="number"
                            value={formData.metadata.bathrooms || ''}
                            onChange={(e) => handleMetadataChange('bathrooms', parseInt(e.target.value))}
                            placeholder="2"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Площадь (м²)</Label>
                          <Input
                            type="number"
                            value={formData.metadata.area || ''}
                            onChange={(e) => handleMetadataChange('area', parseInt(e.target.value))}
                            placeholder="150"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Удобства</Label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                          {AMENITIES.map((amenity) => (
                            <div key={amenity} className="flex items-center gap-2">
                              <Checkbox
                                id={`amenity-${amenity}`}
                                checked={formData.metadata.amenities?.includes(amenity) || false}
                                onCheckedChange={(checked) => {
                                  const current = formData.metadata.amenities || []
                                  const updated = checked
                                    ? [...current, amenity]
                                    : current.filter(a => a !== amenity)
                                  handleMetadataChange('amenities', updated)
                                }}
                              />
                              <Label htmlFor={`amenity-${amenity}`} className="cursor-pointer text-sm">
                                {amenity}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Vehicle Fields */}
                  {selectedCategory.slug === 'vehicles' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Марка</Label>
                          <Input
                            value={formData.metadata.brand || ''}
                            onChange={(e) => handleMetadataChange('brand', e.target.value)}
                            placeholder="Honda"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Модель</Label>
                          <Input
                            value={formData.metadata.model || ''}
                            onChange={(e) => handleMetadataChange('model', e.target.value)}
                            placeholder="CB650R"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Год</Label>
                          <Input
                            type="number"
                            value={formData.metadata.year || ''}
                            onChange={(e) => handleMetadataChange('year', parseInt(e.target.value))}
                            placeholder="2024"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Объём (cc)</Label>
                          <Input
                            type="number"
                            value={formData.metadata.cc || ''}
                            onChange={(e) => handleMetadataChange('cc', parseInt(e.target.value))}
                            placeholder="650"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* Yacht Fields */}
                  {selectedCategory.slug === 'yachts' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Вместимость</Label>
                        <Input
                          type="number"
                          value={formData.metadata.capacity || ''}
                          onChange={(e) => handleMetadataChange('capacity', parseInt(e.target.value))}
                          placeholder="12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Длина (ft)</Label>
                        <Input
                          type="number"
                          value={formData.metadata.length || ''}
                          onChange={(e) => handleMetadataChange('length', parseInt(e.target.value))}
                          placeholder="45"
                        />
                      </div>
                    </div>
                  )}

                  {/* Tours Fields */}
                  {selectedCategory.slug === 'tours' && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Продолжительность</Label>
                          <Input
                            value={formData.metadata.duration || ''}
                            onChange={(e) => handleMetadataChange('duration', e.target.value)}
                            placeholder="8 часов"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Макс. группа</Label>
                          <Input
                            type="number"
                            value={formData.metadata.groupSize || ''}
                            onChange={(e) => handleMetadataChange('groupSize', parseInt(e.target.value))}
                            placeholder="15"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="meals"
                          checked={formData.metadata.meals || false}
                          onCheckedChange={(checked) => handleMetadataChange('meals', checked)}
                        />
                        <Label htmlFor="meals" className="cursor-pointer">Включает питание</Label>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Multi-Source iCal Manager */}
            <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl flex items-center justify-center">
                    <Link2 className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Синхронизация календаря</CardTitle>
                    <CardDescription>Импорт занятых дат из внешних платформ</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add new source */}
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://www.airbnb.com/calendar/ical/..."
                    value={newIcalUrl}
                    onChange={(e) => setNewIcalUrl(e.target.value)}
                    className="flex-1 bg-white"
                    data-testid="ical-url-input"
                  />
                  <Button
                    type="button"
                    onClick={addIcalSource}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Sources list */}
                {icalSources.length > 0 ? (
                  <div className="space-y-2">
                    {icalSources.map((source) => {
                      const config = ICAL_SOURCES.find(s => s.value === source.source) || ICAL_SOURCES[4]
                      return (
                        <div
                          key={source.id}
                          className="flex items-center justify-between bg-white rounded-lg p-3 border border-orange-200"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Badge className={config.color}>{config.label}</Badge>
                            <span className="text-xs text-slate-500 truncate max-w-[200px]">
                              {source.url}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-amber-600 border-amber-300">
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeIcalSource(source.id)}
                              className="text-red-500 hover:text-red-600 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-500">
                    <Calendar className="h-10 w-10 mx-auto mb-2 text-orange-300" />
                    <p className="text-sm">Нет подключённых календарей</p>
                    <p className="text-xs text-slate-400">Добавьте iCal ссылку для блокировки дат</p>
                  </div>
                )}

                <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg text-xs text-orange-700">
                  <p className="font-medium mb-1">💡 Где найти iCal ссылку:</p>
                  <ul className="space-y-0.5 text-orange-600">
                    <li>• <b>Airbnb:</b> Календарь → Доступность → Экспорт</li>
                    <li>• <b>Booking:</b> Объект → Цены → Синхронизация</li>
                    <li>• <b>VRBO:</b> Календарь → iCal → Экспорт</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Step 3: Images with Real Upload */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileImage className="h-5 w-5 text-teal-600" />
                Фотографии
              </CardTitle>
              <CardDescription>
                Загрузите изображения вашего объекта (минимум 1, макс. 10)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Upload Progress */}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-teal-600 font-medium">Загрузка...</span>
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
                data-testid="file-input"
              />

              {/* Image Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {formData.images.map((img, index) => (
                  <div key={index} className="relative group aspect-video">
                    <img
                      src={typeof img === 'string' ? img : img.url}
                      alt={`Image ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border-2 border-slate-200"
                    />
                    {index === 0 && (
                      <Badge className="absolute top-2 left-2 bg-teal-600">
                        Обложка
                      </Badge>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition shadow-lg"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    {typeof img !== 'string' && img.name && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 rounded-b-lg truncate">
                        {img.name}
                      </div>
                    )}
                  </div>
                ))}

                {/* Upload Button */}
                {formData.images.length < 10 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="aspect-video border-2 border-dashed border-slate-300 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-teal-600 disabled:opacity-50"
                    data-testid="upload-button"
                  >
                    {uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin" />
                    ) : (
                      <Upload className="h-8 w-8" />
                    )}
                    <span className="text-sm font-medium">
                      {uploading ? 'Загрузка...' : 'Выбрать файлы'}
                    </span>
                    <span className="text-xs text-slate-400">
                      JPG, PNG, WebP (до 10MB)
                    </span>
                  </button>
                )}
              </div>

              {formData.images.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700">
                    Добавьте хотя бы одно изображение для создания листинга
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation & Submit Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {step > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
          ) : (
            <div />
          )}
          
          <div className="flex gap-3">
            {step === 3 && (
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(true)}
                disabled={savingDraft || loading || !isStep1Valid}
                className="border-amber-300 text-amber-700 hover:bg-amber-50"
                data-testid="save-draft-button"
              >
                {savingDraft ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Сохранить черновик
              </Button>
            )}
            
            {step < 3 ? (
              <Button
                type="button"
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !isStep1Valid}
                className="bg-teal-600 hover:bg-teal-700"
              >
                Далее
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={loading || savingDraft || !isStep3Valid}
                className="bg-teal-600 hover:bg-teal-700"
                data-testid="create-listing-button"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Создание...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Создать листинг
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
