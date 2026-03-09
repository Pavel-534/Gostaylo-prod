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
  Trash2, Image as ImageIcon, FileImage, AlertCircle, CheckCircle2, Plus, Send
} from 'lucide-react'
import { toast } from 'sonner'
import CalendarSyncManager from '@/components/calendar-sync-manager'
import AvailabilityCalendar from '@/components/availability-calendar'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL

export default function EditListing({ params }) {
  const router = useRouter()
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const listingId = params?.id
  const fileInputRef = useRef(null)
  
  const [listing, setListing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  
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

  async function loadListing() {
    try {
      // Use server API that bypasses RLS
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        credentials: 'include'
      })
      const result = await res.json()
      
      console.log('[EDIT] API response:', result)
      
      if (result.success && result.listing) {
        const l = result.listing
        setListing(l)
        
        // Find cover index
        const images = l.images || []
        const coverIndex = l.coverImage ? images.findIndex(img => img === l.coverImage) : 0
        
        setFormData({
          title: l.title || '',
          description: l.description || '',
          basePriceThb: l.basePriceThb?.toString() || '',
          district: l.district || '',
          images: images,
          coverIndex: coverIndex >= 0 ? coverIndex : 0
        })
        
        // Load seasonal pricing from metadata
        if (l.metadata?.seasonal_pricing) {
          setSeasons(l.metadata.seasonal_pricing)
        }
      } else {
        console.error('[EDIT] Failed to load:', result.error)
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
      
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          basePriceThb: parseFloat(formData.basePriceThb) || 0,
          district: formData.district,
          images: formData.images,
          coverImage: coverImage,
          metadata: {
            seasonal_pricing: seasons
          }
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        toast.success('✅ Объявление сохранено!')
        router.push('/partner/listings')
      } else {
        toast.error(result.error || 'Ошибка при сохранении')
      }
    } catch (error) {
      console.error('Failed to save listing:', error)
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    // Validate required fields
    if (!formData.title || !formData.basePriceThb || formData.images.length === 0) {
      toast.error('Заполните название, цену и добавьте фото')
      return
    }
    
    setPublishing(true)
    
    try {
      const coverImage = formData.images[formData.coverIndex] || formData.images[0] || null
      
      // Save and change status to PENDING
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          basePriceThb: parseFloat(formData.basePriceThb) || 0,
          district: formData.district,
          images: formData.images,
          coverImage: coverImage,
          status: 'PENDING',
          metadata: {
            is_draft: false,
            seasonal_pricing: seasons,
            published_at: new Date().toISOString()
          }
        })
      })
      
      const result = await res.json()
      
      if (result.success) {
        toast.success('🚀 Объявление отправлено на модерацию!')
        router.push('/partner/listings')
      } else {
        toast.error(result.error || 'Ошибка при публикации')
      }
    } catch (error) {
      console.error('Failed to publish:', error)
      toast.error('Ошибка при публикации')
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
        toast.success(`✅ Загружено ${uploadedUrls.length} фото`)
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

  // Check if can publish
  const canPublish = formData.title && formData.basePriceThb && formData.images.length > 0
  const isDraft = listing?.metadata?.is_draft

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
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Войдите в систему</h2>
        <p className="text-slate-500 text-center mb-6">
          Для редактирования листинга необходимо авторизоваться
        </p>
        <Button
          onClick={() => {
            // Use auth context openLoginModal if available
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('open-login-modal', { detail: { mode: 'login' } }))
            }
          }}
          className="bg-teal-600 hover:bg-teal-700"
        >
          Войти
        </Button>
      </div>
    )
  }

  if (!listing) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <p className="text-slate-600 mb-4">Объявление не найдено</p>
        <Button asChild className="bg-teal-600 hover:bg-teal-700">
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
                {isDraft ? 'Заполнить черновик' : 'Редактирование'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <Badge className={`text-xs ${isDraft ? 'bg-amber-100 text-amber-700 border-amber-300' : statusColors[listing.status]}`}>
                  {isDraft ? '📝 Черновик' : listing.status === 'ACTIVE' ? 'Активный' : listing.status === 'PENDING' ? 'На модерации' : 'Неактивный'}
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
                Сохранить
              </Button>
              {isDraft && (
                <Button
                  onClick={handlePublish}
                  disabled={!canPublish || saving || publishing}
                  className="bg-teal-600 hover:bg-teal-700"
                  size="sm"
                >
                  {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 lg:mr-2" />}
                  <span className="hidden lg:inline">Опубликовать</span>
                </Button>
              )}
            </div>
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

        {/* Manual Availability Calendar */}
        <AvailabilityCalendar 
          listingId={listingId}
          syncErrors={[]}
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
                  <div key={season.id} className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{season.name}</p>
                        <p className="text-xs text-slate-500">
                          {new Date(season.startDate).toLocaleDateString('ru-RU')} — {new Date(season.endDate).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSeason(season.id)}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 w-8 flex-shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge className={season.priceMultiplier > 1 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                        {season.priceMultiplier > 1 ? '+' : ''}{Math.round((season.priceMultiplier - 1) * 100)}%
                      </Badge>
                      <span className="font-bold text-teal-600 text-lg">
                        ฿{Math.round(parseFloat(formData.basePriceThb || 0) * season.priceMultiplier)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add new season form */}
            <div className="bg-white/80 rounded-lg p-3 sm:p-4 border border-teal-200">
              <Label className="text-sm font-medium mb-3 block">Добавить сезон</Label>
              <div className="space-y-3">
                <Input
                  placeholder="Название (напр. Высокий сезон)"
                  value={newSeason.name}
                  onChange={(e) => setNewSeason({ ...newSeason, name: e.target.value })}
                  className="w-full"
                />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Начало</Label>
                    <Input
                      type="date"
                      value={newSeason.startDate}
                      onChange={(e) => setNewSeason({ ...newSeason, startDate: e.target.value })}
                      className="w-full text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 mb-1 block">Конец</Label>
                    <Input
                      type="date"
                      value={newSeason.endDate}
                      onChange={(e) => setNewSeason({ ...newSeason, endDate: e.target.value })}
                      className="w-full text-sm"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <Label className="text-xs text-slate-500 whitespace-nowrap">Множитель:</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="3"
                      value={newSeason.priceMultiplier}
                      onChange={(e) => setNewSeason({ ...newSeason, priceMultiplier: e.target.value })}
                      className="w-20 text-center"
                    />
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      = ฿{Math.round(parseFloat(formData.basePriceThb || 0) * (parseFloat(newSeason.priceMultiplier) || 1))}
                    </span>
                  </div>
                  <Button
                    onClick={addSeason}
                    className="bg-teal-600 hover:bg-teal-700 w-full sm:w-auto"
                    size="sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Добавить
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons - Mobile Fixed Footer */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-3 z-50 safe-area-pb">
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={saving || publishing}
              variant="outline"
              className="flex-1"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить
                </>
              )}
            </Button>
            {isDraft && (
              <Button
                onClick={handlePublish}
                disabled={!canPublish || saving || publishing}
                className="flex-1 bg-teal-600 hover:bg-teal-700"
              >
                {publishing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Опубликовать
                  </>
                )}
              </Button>
            )}
          </div>
          {isDraft && !canPublish && (
            <p className="text-xs text-amber-600 mt-2 text-center">
              Добавьте название, цену и фото для публикации
            </p>
          )}
        </div>
        
        {/* Spacer for fixed footer on mobile */}
        <div className="lg:hidden h-24" />
      </div>
    </div>
  )
}
