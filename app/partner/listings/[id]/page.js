'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Save, Loader2, Calendar, Link2, HelpCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import SeasonalPriceManager from '@/components/seasonal-price-manager'
import PriceCalendarPreview from '@/components/price-calendar-preview'
import Link from 'next/link'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export default function EditListing({ params }) {
  const router = useRouter()
  const listingId = params?.id
  
  const [listing, setListing] = useState(null)
  const [seasonalPrices, setSeasonalPrices] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    basePriceThb: '',
    icalUrl: '',
  })
  const [syncingCalendar, setSyncingCalendar] = useState(false)

  useEffect(() => {
    if (listingId) {
      loadListing()
      loadSeasonalPrices()
    }
  }, [listingId])

  async function loadListing() {
    try {
      // Use direct Supabase call to avoid k8s routing issues
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      )
      const data = await res.json()
      
      if (data && data.length > 0) {
        const l = data[0];
        setListing({
          id: l.id,
          title: l.title,
          description: l.description,
          basePriceThb: l.base_price_thb,
          status: l.status,
          categoryId: l.category_id,
          district: l.district,
          images: l.images || [],
          metadata: l.metadata || {},
          icalUrl: l.ical_url || l.metadata?.icalUrl || ''
        })
        setFormData({
          title: l.title,
          description: l.description,
          basePriceThb: l.base_price_thb?.toString() || '',
          icalUrl: l.ical_url || l.metadata?.icalUrl || '',
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load listing:', error)
      setLoading(false)
      toast.error('Ошибка при загрузке объявления')
    }
  }

  async function loadSeasonalPrices() {
    try {
      // Use direct Supabase call
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwMjkxMzUsImV4cCI6MjA4NzYwNTEzNX0.vSrBY_n8_KqAi0yzN-g9LZqTkbbjloSakXq5o_28r4k';
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/seasonal_prices?listing_id=eq.${listingId}&select=*`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        }
      )
      const data = await res.json()
      setSeasonalPrices(data || [])
    } catch (error) {
      console.error('Failed to load seasonal prices:', error)
    }
  }

  async function handleSave() {
    setSaving(true)
    
    try {
      // Update listing via direct Supabase call
      const SUPABASE_URL = 'https://vtzzcdsjwudkaloxhvnw.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0enpjZHNqd3Vka2Fsb3hodm53Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjAyOTEzNSwiZXhwIjoyMDg3NjA1MTM1fQ.KqUyt_yX_Ts45MyOKtZ532-UXbgU9WVvwOtnN94zG8I';
      
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/listings?id=eq.${listingId}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            title: formData.title,
            description: formData.description,
            base_price_thb: parseFloat(formData.basePriceThb),
            ical_url: formData.icalUrl || null,
            metadata: {
              ...listing?.metadata,
              icalUrl: formData.icalUrl || null
            },
            updated_at: new Date().toISOString()
          })
        }
      )
      
      if (res.ok) {
        toast.success('Объявление обновлено')
        loadListing()
      } else {
        const errorData = await res.json()
        toast.error(errorData.message || 'Ошибка при сохранении')
      }
    } catch (error) {
      console.error('Failed to save listing:', error)
      toast.error('Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-900">Редактировать объявление</h1>
              <p className="text-sm text-slate-600 mt-1">ID: {listingId}</p>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Основная информация</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Название</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="basePrice">Базовая цена (THB/день)</Label>
              <Input
                id="basePrice"
                type="number"
                value={formData.basePriceThb}
                onChange={(e) => setFormData({ ...formData, basePriceThb: e.target.value })}
              />
              <p className="text-xs text-slate-500">
                Эта цена используется когда не установлены сезонные цены
              </p>
            </div>
          </CardContent>
        </Card>

        {/* iCal Calendar Sync Section */}
        <Card className="border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-orange-600" />
              Sync Calendar (iCal)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="ml-1">
                      <HelpCircle className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-sm">
                      Вставьте iCal ссылку из Airbnb или Booking.com, чтобы автоматически блокировать занятые даты и предотвратить двойные бронирования.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="icalUrl" className="flex items-center gap-2">
                iCal URL
                <span className="text-xs text-slate-500">(Airbnb, Booking.com, VRBO)</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="icalUrl"
                  type="url"
                  placeholder="https://www.airbnb.com/calendar/ical/123456.ics"
                  value={formData.icalUrl}
                  onChange={(e) => setFormData({ ...formData, icalUrl: e.target.value })}
                  className="flex-1"
                  data-testid="ical-url-input"
                />
                {formData.icalUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(formData.icalUrl, '_blank')}
                    title="Открыть iCal"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-600">
                💡 <strong>Как найти iCal ссылку:</strong>
              </p>
              <ul className="text-xs text-slate-500 space-y-1 ml-4">
                <li>• <strong>Airbnb:</strong> Calendar → Availability → Export Calendar</li>
                <li>• <strong>Booking.com:</strong> Property → Rates & Availability → Sync Calendars</li>
                <li>• <strong>VRBO:</strong> Calendar → iCal Settings → Export URL</li>
              </ul>
            </div>

            {formData.icalUrl && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-800 font-medium">
                    Календарь будет синхронизирован автоматически
                  </span>
                </div>
                <p className="text-xs text-green-600 mt-1 ml-4">
                  Занятые даты из внешних платформ будут блокироваться в FunnyRent
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seasonal Pricing Section */}
        <div className="bg-gradient-to-br from-teal-50 to-blue-50 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-teal-600 rounded-lg flex items-center justify-center">
              <Calendar className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Динамическое ценообразование</h2>
              <p className="text-sm text-slate-600">
                Управляйте ценами в зависимости от сезона и спроса
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Seasonal Price Manager */}
            <SeasonalPriceManager
              listingId={listingId}
              basePriceThb={listing.basePriceThb}
            />

            {/* Price Calendar Preview */}
            <PriceCalendarPreview
              seasonalPrices={seasonalPrices}
              basePriceThb={listing.basePriceThb}
            />
          </div>
        </div>

        {/* Images Section (Placeholder) */}
        <Card>
          <CardHeader>
            <CardTitle>Фотографии</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {listing.images?.map((img, index) => (
                <div key={index} className="relative aspect-video">
                  <img
                    src={img}
                    alt={`Image ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
