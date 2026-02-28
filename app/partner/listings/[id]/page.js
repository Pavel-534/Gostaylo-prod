'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  ArrowLeft, Save, Loader2, Calendar, X, Upload, Star, 
  Trash2, Image as ImageIcon, FileImage, AlertCircle, CheckCircle2, Plus
} from 'lucide-react'
import { toast } from 'sonner'
import CalendarSyncManager from '@/components/calendar-sync-manager'
import Link from 'next/link'

const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k'
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I'

export default function EditListing({ params }) {
  const router = useRouter()
  const listingId = params?.id
  const fileInputRef = useRef(null)
  
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    basePriceThb: '',
    district: '',
    images: [],
    coverIndex: 0
  })
  
  // Seasonal pricing state
  const [seasons, setSeasons] = useState([])
  const [newSeason, setNewSeason] = useState({
    name: '',
    startDate: '',
    endDate: '',
    priceMultiplier: 1.0
  })

  useEffect(() => {
    if (listingId) {
      loadListing()
    }
  }, [listingId])

  async function loadListing() {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=*`,
        { headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } }
      )
      const data = await res.json()
      
      if (data && data.length > 0) {
        const l = data[0]
        setListing(l)
        
        // Find cover index
        const images = l.images || []
        const coverIndex = l.cover_image ? images.findIndex(img => img === l.cover_image) : 0
        
        setFormData({
          title: l.title || '',
          description: l.description || '',
          basePriceThb: l.base_price_thb?.toString() || '',
          district: l.district || '',
          images: images,
          coverIndex: coverIndex >= 0 ? coverIndex : 0
        })
        
        // Load seasonal pricing from metadata
        if (l.metadata?.seasonal_pricing) {
          setSeasons(l.metadata.seasonal_pricing)
        }
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listing:', error)
      setLoading(false)
      toast.error('Ошибка при загрузке объявления')
    }
  }

  async function handleSave() {
    setSaving(true)
    
    try {
      const coverImage = formData.images[formData.coverIndex] || formData.images[0] || null
      
      // First get current metadata to preserve other fields
      const getRes = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=metadata`,
        { headers: { 'apikey': SUPABASE_SERVICE_KEY, 'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}` } }
      )
      const getData = await getRes.json()
      const currentMetadata = getData?.[0]?.metadata || {}
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            base_price_thb: parseFloat(formData.basePriceThb),
            district: formData.district,
            images: formData.images,
            cover_image: coverImage,
            metadata: {
              ...currentMetadata,
              seasonal_pricing: seasons
            },
            updated_at: new Date().toISOString()
          })
        }
      )
      
      if (res.ok) {
        toast.success('✅ Объявление сохранено!')
        loadListing()
      } else {
        toast.error('Ошибка при сохранении')
      }
    } catch (error) {
      console.error('Failed to save listing:', error)
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
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
    setTimeout(() => setUploadProgress(0), 1500)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function removeImage(index) {
    const imageUrl = formData.images[index]
    
    // Try to delete from Supabase Storage if it's a storage URL
    if (typeof imageUrl === 'string' && imageUrl.includes('supabase.co/storage')) {
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
    toast.success('Фото удалено')
  }

  function setAsCover(index) {
    setFormData({ ...formData, coverIndex: index })
    toast.success('Обложка установлена')
  }

  // Seasonal pricing functions
  function addSeason() {
    if (!newSeason.name || !newSeason.startDate || !newSeason.endDate) {
      toast.error('Заполните все поля сезона')
      return
    }
    
    const season = {
      id: `season-${Date.now()}`,
      name: newSeason.name,
      startDate: newSeason.startDate,
      endDate: newSeason.endDate,
      priceMultiplier: parseFloat(newSeason.priceMultiplier) || 1.0
    }
    
    setSeasons([...seasons, season])
    setNewSeason({ name: '', startDate: '', endDate: '', priceMultiplier: 1.0 })
    toast.success('Сезон добавлен')
  }
  
  function removeSeason(id) {
    setSeasons(seasons.filter(s => s.id !== id))
    toast.success('Сезон удалён')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-600">Объявление не найдено</p>
        <Button asChild className="mt-4">
          <Link href="/partner/listings">Вернуться к списку</Link>
        </Button>
      </div>
    )
  }

  const statusColors = {
    ACTIVE: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    INACTIVE: 'bg-slate-100 text-slate-700',
  }

  const isDraft = listing.metadata?.is_draft

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 lg:py-4">
          <div className="flex items-center gap-3 lg:gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg lg:text-2xl font-bold text-slate-900 truncate">
                Редактирование
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 truncate">{listingId}</span>
                <Badge className={isDraft ? 'bg-slate-100 text-slate-600 border-dashed border' : statusColors[listing.status]}>
                  {isDraft ? 'Черновик' : listing.status === 'ACTIVE' ? 'Активный' : 'На модерации'}
                </Badge>
              </div>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
              size="sm"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 lg:mr-2" />
                  <span className="hidden lg:inline">Сохранить</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 lg:py-8 max-w-4xl space-y-4 lg:space-y-6">
        
        {/* Basic Info - Mobile Optimized */}
        <Card>
          <CardHeader className="pb-2 lg:pb-4">
            <CardTitle className="text-base lg:text-lg">Основная информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm">Название</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Роскошная вилла..."
                className="text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-sm">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
                className="text-base"
                placeholder="Подробное описание объекта..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price" className="text-sm">Цена (THB/день)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.basePriceThb}
                  onChange={(e) => setFormData({ ...formData, basePriceThb: e.target.value })}
                  placeholder="15000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="district" className="text-sm">Район</Label>
                <Input
                  id="district"
                  value={formData.district}
                  onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  placeholder="Rawai"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Media Management - Mobile First */}
        <Card>
          <CardHeader className="pb-2 lg:pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  <FileImage className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-base lg:text-lg">Фотографии</CardTitle>
                  <CardDescription className="text-xs">{formData.images.length} из 30</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-600 font-medium">Загрузка...</span>
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
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {formData.images.map((img, index) => (
                <div key={index} className="relative group aspect-video rounded-lg overflow-hidden border-2 border-slate-200">
                  <img
                    src={img}
                    alt={`Image ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Cover badge */}
                  {index === formData.coverIndex && (
                    <Badge className="absolute top-2 left-2 bg-teal-600 text-white">
                      <Star className="h-3 w-3 mr-1" />
                      Обложка
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
                        <Star className="h-3 w-3 mr-1" />
                        Обложка
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
                  <span className="text-xs font-medium">Добавить</span>
                </button>
              )}
            </div>

            {formData.images.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                <p className="text-sm text-amber-700">Добавьте хотя бы одно фото</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* iCal Calendar Sync */}
        <CalendarSyncManager 
          listingId={listingId}
          onSync={() => {}}
        />

        {/* Seasonal Pricing Section */}
        <Card className="border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50">
          <CardHeader className="pb-2 lg:pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center">
                <Calendar className="h-4 w-4 lg:h-5 lg:w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-base lg:text-lg">Сезонные цены</CardTitle>
                <CardDescription className="text-xs">Настройте цены для разных сезонов</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Base price info */}
            <div className="bg-white/80 rounded-lg p-3 border border-teal-200">
              <p className="text-sm text-slate-600">
                Базовая цена: <span className="font-bold text-teal-700">฿{formData.basePriceThb || '0'}</span>/день
              </p>
            </div>
            
            {/* Existing seasons */}
            {seasons.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Активные сезоны ({seasons.length})</Label>
                {seasons.map((season) => (
                  <div key={season.id} className="bg-white rounded-lg p-3 border border-slate-200 flex items-center justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-slate-900">{season.name}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(season.startDate).toLocaleDateString('ru-RU')} — {new Date(season.endDate).toLocaleDateString('ru-RU')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={season.priceMultiplier > 1 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                        {season.priceMultiplier > 1 ? '+' : ''}{Math.round((season.priceMultiplier - 1) * 100)}%
                      </Badge>
                      <span className="font-bold text-teal-600">
                        ฿{Math.round(parseFloat(formData.basePriceThb || 0) * season.priceMultiplier)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSeason(season.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add new season form */}
            <div className="bg-white/80 rounded-lg p-4 border border-teal-200">
              <Label className="text-sm font-medium mb-3 block">Добавить сезон</Label>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <Input
                  placeholder="Название (напр. Высокий сезон)"
                  value={newSeason.name}
                  onChange={(e) => setNewSeason({ ...newSeason, name: e.target.value })}
                  className="md:col-span-2"
                />
                <Input
                  type="date"
                  value={newSeason.startDate}
                  onChange={(e) => setNewSeason({ ...newSeason, startDate: e.target.value })}
                  className="text-sm"
                />
                <Input
                  type="date"
                  value={newSeason.endDate}
                  onChange={(e) => setNewSeason({ ...newSeason, endDate: e.target.value })}
                  className="text-sm"
                />
              </div>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500">Множитель цены:</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="3"
                    value={newSeason.priceMultiplier}
                    onChange={(e) => setNewSeason({ ...newSeason, priceMultiplier: e.target.value })}
                    className="w-20 text-center"
                  />
                  <span className="text-xs text-slate-500">
                    = ฿{Math.round(parseFloat(formData.basePriceThb || 0) * (parseFloat(newSeason.priceMultiplier) || 1))}
                  </span>
                </div>
                <Button
                  onClick={addSeason}
                  className="bg-teal-600 hover:bg-teal-700 ml-auto"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Добавить
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons - Mobile Fixed Footer */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-50">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-teal-600 hover:bg-teal-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Сохранение...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Сохранить изменения
              </>
            )}
          </Button>
        </div>
        
        {/* Spacer for fixed footer on mobile */}
        <div className="lg:hidden h-20" />
      </div>
    </div>
  )
}
