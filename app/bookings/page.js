'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Calendar, MapPin, Loader2, ArrowLeft, CreditCard } from 'lucide-react'
import { formatPrice } from '@/lib/currency'

export default function MyAllBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBookings()
  }, [])

  async function loadBookings() {
    try {
      // Mock: Load all bookings for renter-1
      const res = await fetch('/api/partner/bookings?partnerId=partner-1')
      const data = await res.json()
      
      if (data.success) {
        // Filter for this demo - in real app would have renter-specific endpoint
        setBookings(data.data)
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load bookings:', error)
      setLoading(false)
    }
  }

  function getStatusBadge(status) {
    const statusConfig = {
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Ожидает' },
      CONFIRMED: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Подтверждено' },
      PAID: { bg: 'bg-green-100', text: 'text-green-700', label: 'Оплачено' },
      COMPLETED: { bg: 'bg-teal-100', text: 'text-teal-700', label: 'Завершено' },
      CANCELLED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Отменено' },
    }
    
    const config = statusConfig[status] || statusConfig.PENDING
    
    return (
      <Badge className={`${config.bg} ${config.text}`}>
        {config.label}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center text-teal-600 hover:text-teal-700 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            На главную
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Мои бронирования</h1>
          <p className="text-slate-600">Управление вашими бронированиями</p>
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Calendar className="h-16 w-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">Нет бронирований</h3>
              <p className="text-slate-600 mb-4">Начните поиск жилья на Пхукете</p>
              <Button asChild className="bg-teal-600 hover:bg-teal-700">
                <Link href="/">Перейти к поиску</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
              <Card key={booking.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2">
                        {booking.listingTitle || `Бронирование #${booking.id.slice(0, 8)}`}
                      </CardTitle>
                      <CardDescription className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {new Date(booking.checkIn).toLocaleDateString('ru-RU')} -{' '}
                            {new Date(booking.checkOut).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>Phuket, Thailand</span>
                        </div>
                      </CardDescription>
                    </div>
                    {getStatusBadge(booking.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="text-sm text-slate-600 mb-1">Стоимость</p>
                      <p className="text-2xl font-bold text-slate-900">
                        {formatPrice(booking.priceThb, 'THB')}
                      </p>
                    </div>
                    
                    {booking.status === 'CONFIRMED' && (
                      <Link href={`/checkout/${booking.id}`}>
                        <Button className="bg-teal-600 hover:bg-teal-700">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Оплатить
                        </Button>
                      </Link>
                    )}
                    
                    {booking.status === 'PAID' && (
                      <Badge className="bg-green-100 text-green-700 text-base px-4 py-2">
                        ✓ Оплачено
                      </Badge>
                    )}
                    
                    {booking.status === 'COMPLETED' && (
                      <Link href="/my-bookings">
                        <Button variant="outline">
                          Оставить отзыв
                        </Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
