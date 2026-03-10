/**
 * Partner Calendar Page - Unified Availability View
 * 
 * Future: 
 * - iCal sync management
 * - Multi-listing calendar view
 * - Block dates across all listings
 */

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, RefreshCcw, ExternalLink, Loader2, AlertCircle } from 'lucide-react'

export default function PartnerCalendarPage() {
  const [loading, setLoading] = useState(true)
  const [listings, setListings] = useState([])
  const [user, setUser] = useState(null)

  useEffect(() => {
    const storedUser = localStorage.getItem('gostaylo_user')
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      setUser(parsed)
      loadListings(parsed.id)
    }
  }, [])

  async function loadListings(partnerId) {
    try {
      const res = await fetch(`/api/v2/partner/listings?partnerId=${partnerId}`)
      const data = await res.json()
      if (data.success) {
        setListings(data.data || [])
      }
    } catch (error) {
      console.error('Failed to load listings:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Календарь</h1>
          <p className="text-slate-500 mt-1">
            Управляйте доступностью ваших объектов
          </p>
        </div>
      </div>

      {/* No Listings State */}
      {listings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="font-semibold text-slate-900 mb-2">Нет объектов</h3>
            <p className="text-slate-500 text-center mb-4 max-w-sm">
              Создайте объявление, чтобы управлять его календарём доступности
            </p>
            <Button asChild className="bg-teal-600 hover:bg-teal-700">
              <Link href="/partner/listings/new">
                Создать объявление
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* Listings Calendar Grid */
        <div className="grid gap-4 md:grid-cols-2">
          {listings.map((listing) => (
            <Card key={listing.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <CardTitle className="text-base truncate">
                      {listing.title || 'Без названия'}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {listing.location?.district || listing.location?.city || 'Локация не указана'}
                    </CardDescription>
                  </div>
                  <Badge variant={listing.status === 'ACTIVE' ? 'default' : 'secondary'}>
                    {listing.status === 'ACTIVE' ? 'Активно' : listing.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                {/* iCal Status */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">iCal синхронизация:</span>
                  <span className={listing.icalUrl ? 'text-teal-600' : 'text-slate-400'}>
                    {listing.icalUrl ? 'Подключено' : 'Не настроено'}
                  </span>
                </div>
                
                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/partner/listings/${listing.id}?tab=calendar`}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Календарь
                    </Link>
                  </Button>
                  {listing.icalUrl && (
                    <Button variant="ghost" size="sm" className="text-slate-500">
                      <RefreshCcw className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Info Card */}
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-slate-600">
              <p className="font-medium text-slate-900 mb-1">О календаре</p>
              <p>
                Управляйте доступностью каждого объекта отдельно. Перейдите в карточку 
                объекта для настройки ручных блокировок или подключения iCal синхронизации 
                с Airbnb, Booking.com и другими платформами.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
