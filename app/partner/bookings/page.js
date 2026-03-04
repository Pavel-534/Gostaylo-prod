'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/currency'
import { Calendar, Mail, Phone, User, DollarSign, Check, X, Clock } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

export default function PartnerBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    loadBookings()
  }, [])

  async function loadBookings() {
    try {
      const res = await fetch('/api/partner/bookings')
      const data = await res.json()
      setBookings(data.data || [])
      setLoading(false)
    } catch (error) {
      console.error('Failed to load bookings:', error)
      setLoading(false)
    }
  }

  async function updateBookingStatus(bookingId, newStatus) {
    try {
      const res = await fetch(`/api/partner/bookings/${bookingId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await res.json()

      if (data.success) {
        setBookings(bookings.map(b => 
          b.id === bookingId ? { ...b, status: newStatus } : b
        ))
        toast.success(`Статус обновлён: ${statusLabels[newStatus]}`)
      }
    } catch (error) {
      console.error('Failed to update status:', error)
      toast.error('Ошибка при обновлении статуса')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
      </div>
    )
  }

  const statusColors = {
    PENDING: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    CONFIRMED: 'bg-green-100 text-green-700 border-green-200',
    CANCELLED: 'bg-red-100 text-red-700 border-red-200',
    COMPLETED: 'bg-blue-100 text-blue-700 border-blue-200',
  }

  const statusLabels = {
    PENDING: 'Ожидание',
    CONFIRMED: 'Подтверждено',
    CANCELLED: 'Отменено',
    COMPLETED: 'Завершено',
  }

  const filteredBookings = filter === 'all' 
    ? bookings 
    : bookings.filter(b => b.status === filter)

  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'PENDING').length,
    confirmed: bookings.filter(b => b.status === 'CONFIRMED').length,
    revenue: bookings
      .filter(b => b.status === 'CONFIRMED')
      .reduce((sum, b) => sum + (b.priceThb - b.commissionThb), 0),
  }

  return (
    <div className="p-4 lg:p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Бронирования</h1>
        <p className="text-slate-600 mt-1">
          Управляйте заказами и общайтесь с клиентами
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Всего бронирований
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Ожидают подтверждения
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Подтверждено
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.confirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600">
              Доход (чистый)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-600">
              {formatPrice(stats.revenue, 'THB')}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все бронирования</SelectItem>
            <SelectItem value="PENDING">Ожидание</SelectItem>
            <SelectItem value="CONFIRMED">Подтверждено</SelectItem>
            <SelectItem value="COMPLETED">Завершено</SelectItem>
            <SelectItem value="CANCELLED">Отменено</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-slate-600">
          Показано: {filteredBookings.length} из {bookings.length}
        </div>
      </div>

      {/* Bookings Table */}
      {filteredBookings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Нет бронирований
            </h3>
            <p className="text-slate-600 text-center max-w-md">
              Когда клиенты забронируют ваши листинги, они появятся здесь
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Гость</TableHead>
                    <TableHead>Листинг</TableHead>
                    <TableHead>Даты</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Комиссия</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBookings.map((booking) => {
                    // Handle both camelCase and snake_case from API
                    const guestName = booking.guestName || booking.guest_name || 'N/A';
                    const guestPhone = booking.guestPhone || booking.guest_phone || '-';
                    const guestEmail = booking.guestEmail || booking.guest_email || '-';
                    const checkIn = booking.checkIn || booking.check_in;
                    const checkOut = booking.checkOut || booking.check_out;
                    const priceThb = booking.priceThb || booking.price_thb || 0;
                    const pricePaid = booking.pricePaid || booking.price_paid || 0;
                    const commissionThb = booking.commissionThb || booking.commission_thb || 0;
                    const currency = booking.currency || 'THB';
                    const listingTitle = booking.listing?.title || booking.listings?.title || 'N/A';
                    const listingDistrict = booking.listing?.district || booking.listings?.district || '-';
                    
                    // Safe date formatting
                    const formatDate = (dateStr) => {
                      if (!dateStr) return 'N/A';
                      try {
                        return new Date(dateStr).toLocaleDateString('ru-RU');
                      } catch {
                        return dateStr;
                      }
                    };

                    return (
                    <TableRow key={booking.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className="font-medium text-slate-900">
                              {guestName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone className="h-3 w-3" />
                            {guestPhone}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Mail className="h-3 w-3" />
                            {guestEmail}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <p className="font-medium text-slate-900 truncate">
                            {listingTitle}
                          </p>
                          <p className="text-sm text-slate-500">
                            {listingDistrict}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1 text-sm">
                          <div>Заезд: {formatDate(checkIn)}</div>
                          <div>Выезд: {formatDate(checkOut)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-900">
                            {formatPrice(priceThb, 'THB')}
                          </div>
                          <div className="text-xs text-slate-500">
                            {currency !== 'THB' && pricePaid > 0 && (
                              <span>({formatPrice(pricePaid, currency)})</span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium text-red-600">
                            -{formatPrice(commissionThb, 'THB')}
                          </div>
                          <div className="text-xs text-slate-500">
                            ({booking.listing?.commissionRate || 15}%)
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[booking.status]}>
                          {statusLabels[booking.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {booking.status === 'PENDING' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:bg-green-50"
                                onClick={() => updateBookingStatus(booking.id, 'CONFIRMED')}
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:bg-red-50"
                                onClick={() => updateBookingStatus(booking.id, 'CANCELLED')}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                          {booking.status === 'CONFIRMED' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 hover:bg-blue-50"
                              onClick={() => updateBookingStatus(booking.id, 'COMPLETED')}
                            >
                              <Check className="h-3 w-3 mr-1" />
                              Завершить
                            </Button>
                          )}
                          {(booking.status === 'COMPLETED' || booking.status === 'CANCELLED') && (
                            <span className="text-sm text-slate-500 px-2">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}