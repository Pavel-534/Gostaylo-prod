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
      const res = await fetch(`/api/listings/${listingId}`)
      const data = await res.json()
      
      if (data.success && data.data) {
        setListing(data.data)
        setFormData({
          title: data.data.title,
          description: data.data.description,
          basePriceThb: data.data.basePriceThb.toString(),
          icalUrl: data.data.icalUrl || data.data.metadata?.icalUrl || '',
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
      const res = await fetch(`/api/listings/${listingId}/seasonal-prices`)
      const data = await res.json()
      
      if (data.success) {
        setSeasonalPrices(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load seasonal prices:', error)
    }
  }

  async function handleSave() {
    setSaving(true)
    
    try {
      // Update basic listing info
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          basePriceThb: parseFloat(formData.basePriceThb),
          icalUrl: formData.icalUrl || null,
        }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        toast.success('Объявление обновлено')
        loadListing()
      } else {
        toast.error(data.error || 'Ошибка при сохранении')
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
