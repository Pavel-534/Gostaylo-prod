'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Upload, X, ArrowLeft, Save, Loader2, Calendar } from 'lucide-react'
import { toast } from 'sonner'

const DISTRICTS = [
  'Rawai', 'Chalong', 'Kata', 'Karon', 'Patong', 'Kamala', 
  'Surin', 'Bang Tao', 'Nai Harn', 'Panwa', 'Mai Khao', 'Nai Yang'
]

const AMENITIES = [
  'Wi-Fi', 'Бассейн', 'Парковка', 'Кондиционер', 'Кухня', 'Прачечная',
  'Охрана', 'Сад', 'Терраса', 'Барбекю', 'Тренажёрный зал', 'Сауна'
]

export default function NewListing() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const [step, setStep] = useState(1)

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
    externalCalUrl: '',
  })

  useEffect(() => {
    loadCategories()
  }, [])

  async function loadCategories() {
    try {
      // Load directly from Supabase to avoid K8s ingress issues
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k'
      
      const res = await fetch(`${SUPABASE_URL}/rest/v1/categories?select=*&order=name.asc`, {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      })
      const data = await res.json()
      setCategories(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Failed to load categories:', error)
      // Fallback to hardcoded categories
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

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    try {
      // Get current user from localStorage
      const storedUser = localStorage.getItem('funnyrent_user')
      const user = storedUser ? JSON.parse(storedUser) : null
      
      if (!user || !user.id) {
        toast.error('Необходимо войти в систему')
        return
      }

      // Create listing directly via Supabase
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co'
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k'
      
      const listingData = {
        id: `lst-${Date.now().toString(36)}`,
        owner_id: user.id,
        category_id: formData.categoryId || '1',
        status: 'PENDING',
        title: formData.title,
        description: formData.description,
        district: formData.district || 'Phuket',
        base_price_thb: parseFloat(formData.basePriceThb) || 10000,
        commission_rate: parseFloat(formData.commissionRate) || 15,
        images: formData.images || [],
        cover_image: formData.images?.[0] || null,
        metadata: {
          ...formData.metadata,
          title: {
            ru: formData.title,
            en: formData.title,
            zh: formData.title,
            th: formData.title
          }
        },
        available: false,
        is_featured: false,
        views: 0
      }

      const res = await fetch(`${SUPABASE_URL}/rest/v1/listings`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(listingData)
      })

      if (res.ok) {
        toast.success('Листинг успешно создан!')
        router.push('/partner/listings')
      } else {
        const error = await res.json()
        console.error('Supabase error:', error)
        toast.error('Ошибка при создании листинга: ' + (error.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Failed to create listing:', error)
      toast.error('Ошибка при создании листинга')
    } finally {
      setLoading(false)
    }
  }

  const selectedCategory = categories.find(c => c.id === formData.categoryId)

  // Mock image upload
  function handleImageUpload() {
    const mockImages = [
      'https://images.pexels.com/photos/33607600/pexels-photo-33607600.jpeg',
      'https://images.unsplash.com/photo-1566735201951-bc1cbeeb2964',
      'https://images.pexels.com/photos/31342032/pexels-photo-31342032.jpeg',
    ]
    const randomImage = mockImages[Math.floor(Math.random() * mockImages.length)]
    setFormData({
      ...formData,
      images: [...formData.images, randomImage],
    })
  }

  function removeImage(index) {
    setFormData({
      ...formData,
      images: formData.images.filter((_, i) => i !== index),
    })
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Добавить новый листинг</h1>
          <p className="text-slate-600 mt-1">
            Заполните информацию о вашем предложении
          </p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                step >= s
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`w-16 h-1 ${
                  step > s ? 'bg-teal-600' : 'bg-slate-200'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent className="z-50 min-w-[200px]">
                    {categories.length === 0 ? (
                      <SelectItem value="loading" disabled>Загрузка...</SelectItem>
                    ) : (
                      categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
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
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="district">Район *</Label>
                  <Select value={formData.district} onValueChange={(v) => handleInputChange('district', v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите район" />
                    </SelectTrigger>
                    <SelectContent>
                      {DISTRICTS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
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
                    onChange={(e) => handleInputChange('basePriceThb', parseFloat(e.target.value))}
                    placeholder="15000"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission">Комиссия платформы (%)</Label>
                <Input
                  id="commission"
                  type="number"
                  value={formData.commissionRate}
                  onChange={(e) => handleInputChange('commissionRate', parseFloat(e.target.value))}
                  disabled
                />
                <p className="text-xs text-slate-500">
                  Стандартная комиссия: 15%
                </p>
              </div>

              {/* NEW: External iCal URL Field */}
              <div className="space-y-2 border-t pt-4">
                <Label htmlFor="externalCalUrl" className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-teal-600" />
                  External iCal URL (Airbnb / Google Calendar)
                </Label>
                <Input
                  id="externalCalUrl"
                  type="url"
                  value={formData.externalCalUrl}
                  onChange={(e) => handleInputChange('externalCalUrl', e.target.value)}
                  placeholder="https://www.airbnb.com/calendar/ical/..."
                />
                <p className="text-xs text-slate-500">
                  📅 Вставьте ссылку на внешний календарь для автоматической синхронизации занятых дат
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Category-Specific Fields */}
        {step === 2 && selectedCategory && (
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
                      <Label>Год выпуска</Label>
                      <Input
                        type="number"
                        value={formData.metadata.year || ''}
                        onChange={(e) => handleMetadataChange('year', parseInt(e.target.value))}
                        placeholder="2024"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Объём двигателя (cc)</Label>
                      <Input
                        type="number"
                        value={formData.metadata.cc || ''}
                        onChange={(e) => handleMetadataChange('cc', parseInt(e.target.value))}
                        placeholder="650"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Трансмиссия</Label>
                    <Select 
                      value={formData.metadata.transmission || ''} 
                      onValueChange={(v) => handleMetadataChange('transmission', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите тип" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Manual">Механика</SelectItem>
                        <SelectItem value="Automatic">Автомат</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Yacht Fields */}
              {selectedCategory.slug === 'yachts' && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Вместимость (чел.)</Label>
                      <Input
                        type="number"
                        value={formData.metadata.capacity || ''}
                        onChange={(e) => handleMetadataChange('capacity', parseInt(e.target.value))}
                        placeholder="12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Длина (футы)</Label>
                      <Input
                        type="number"
                        value={formData.metadata.length || ''}
                        onChange={(e) => handleMetadataChange('length', parseInt(e.target.value))}
                        placeholder="45"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="crew"
                      checked={formData.metadata.crew || false}
                      onCheckedChange={(checked) => handleMetadataChange('crew', checked)}
                    />
                    <Label htmlFor="crew" className="cursor-pointer">
                      Включает экипаж
                    </Label>
                  </div>
                </>
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
                      <Label>Размер группы (макс.)</Label>
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
                    <Label htmlFor="meals" className="cursor-pointer">
                      Включает питание
                    </Label>
                  </div>

                  <div className="space-y-2">
                    <Label>Что включено</Label>
                    <Textarea
                      value={formData.metadata.included?.join(', ') || ''}
                      onChange={(e) => {
                        const items = e.target.value.split(',').map(i => i.trim()).filter(Boolean)
                        handleMetadataChange('included', items)
                      }}
                      placeholder="Обед, гид, транспорт"
                      rows={3}
                    />
                    <p className="text-xs text-slate-500">
                      Перечислите через запятую
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Images */}
        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Фотографии</CardTitle>
              <CardDescription>
                Добавьте изображения вашего объекта (минимум 1)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {formData.images.map((img, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={img}
                      alt={`Image ${index + 1}`}
                      className="w-full h-40 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                {/* Upload Button */}
                <button
                  type="button"
                  onClick={handleImageUpload}
                  className="h-40 border-2 border-dashed border-slate-300 rounded-lg hover:border-teal-500 hover:bg-teal-50 transition flex flex-col items-center justify-center gap-2 text-slate-600 hover:text-teal-600"
                >
                  <Upload className="h-8 w-8" />
                  <span className="text-sm font-medium">Загрузить фото</span>
                  <span className="text-xs">(Mock)</span>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between">
          {step > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Назад
            </Button>
          )}
          
          {step < 3 ? (
            <Button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 1 && (!formData.categoryId || !formData.title || !formData.description || !formData.district || !formData.basePriceThb))
              }
              className="ml-auto bg-teal-600 hover:bg-teal-700"
            >
              Далее
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={loading || formData.images.length === 0}
              className="ml-auto bg-teal-600 hover:bg-teal-700"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Создание...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Создать листинг
                </>
              )}
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
