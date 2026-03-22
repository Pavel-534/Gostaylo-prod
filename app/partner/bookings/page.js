/**
 * Gostaylo - Partner Bookings Page (v2 API)
 * 
 * STERILIZED: All data flows through API v2
 * Uses TanStack Query for reactive state management
 * 
 * @updated 2026-03-13 - Phase 1 Sterilization
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/currency'
import { 
  Calendar, Mail, Phone, User, Check, X, Clock, 
  Loader2, AlertCircle, ChevronRight, MessageSquare,
  CalendarDays, Home, DollarSign
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProxiedImage } from '@/components/proxied-image'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/auth-context'
import { usePartnerBookings, useUpdateBookingStatus } from '@/lib/hooks/use-partner-bookings'
import { differenceInDays, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import Link from 'next/link'

// Status configuration
const STATUS_CONFIG = {
  PENDING: { 
    label: 'Ожидание', 
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: Clock
  },
  CONFIRMED: { 
    label: 'Подтверждено', 
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: Check
  },
  PAID: { 
    label: 'Оплачено', 
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: DollarSign
  },
  CANCELLED: { 
    label: 'Отменено', 
    color: 'bg-red-100 text-red-700 border-red-200',
    icon: X
  },
  COMPLETED: { 
    label: 'Завершено', 
    color: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Check
  },
  REFUNDED: { 
    label: 'Возврат', 
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    icon: DollarSign
  }
}

export default function PartnerBookings() {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const [filter, setFilter] = useState('all')
  const [rejectDialog, setRejectDialog] = useState({ open: false, bookingId: null })
  const [rejectReason, setRejectReason] = useState('')
  const [fallbackPartnerId, setFallbackPartnerId] = useState(null)

  // Fallback partnerId from localStorage (when useAuth is delayed or user from different source)
  useEffect(() => {
    if (user?.id) return
    const stored = localStorage.getItem('gostaylo_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed?.id) setFallbackPartnerId(parsed.id)
      } catch {}
    }
  }, [user?.id])

  const partnerId = user?.id || fallbackPartnerId

  // TanStack Query hook for bookings
  const { 
    data, 
    isLoading, 
    isError, 
    error,
    refetch
  } = usePartnerBookings(partnerId, {
    status: filter,
    enabled: !!partnerId
  })
  
  // Mutation hook for status updates
  const updateStatusMutation = useUpdateBookingStatus()
  
  // Extract bookings and meta from query response
  const bookings = data?.bookings || []
  const totalBookings = data?.total || 0

  // Calculate stats from bookings
  const stats = {
    total: bookings.length,
    pending: bookings.filter(b => b.status === 'PENDING').length,
    confirmed: bookings.filter(b => b.status === 'CONFIRMED' || b.status === 'PAID').length,
    revenue: bookings
      .filter(b => ['CONFIRMED', 'PAID', 'COMPLETED'].includes(b.status))
      .reduce((sum, b) => sum + (b.partnerEarningsThb || 0), 0),
  }

  // Handle confirm booking
  const handleConfirm = (bookingId) => {
    updateStatusMutation.mutate({
      bookingId,
      status: 'CONFIRMED',
      partnerId: user?.id
    })
  }

  // Handle reject booking (opens dialog)
  const handleRejectClick = (bookingId) => {
    setRejectDialog({ open: true, bookingId })
    setRejectReason('')
  }

  // Submit rejection
  const handleRejectSubmit = () => {
    if (!rejectDialog.bookingId) return
    
    updateStatusMutation.mutate({
      bookingId: rejectDialog.bookingId,
      status: 'CANCELLED',
      reason: rejectReason,
      partnerId
    }, {
      onSuccess: () => {
        setRejectDialog({ open: false, bookingId: null })
        setRejectReason('')
      }
    })
  }

  // Handle complete booking
  const handleComplete = (bookingId) => {
    updateStatusMutation.mutate({
      bookingId,
      status: 'COMPLETED',
      partnerId
    })
  }

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Загрузка бронирований...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!isAuthenticated && !fallbackPartnerId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Calendar className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Требуется авторизация</h2>
        <p className="text-slate-500 text-center mb-6">
          Войдите в систему для просмотра бронирований
        </p>
        <Button asChild className="bg-teal-600 hover:bg-teal-700">
          <Link href="/profile?login=true">Войти</Link>
        </Button>
      </div>
    )
  }

  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Ошибка загрузки</h2>
        <p className="text-slate-500 text-center mb-6">{error?.message || 'Не удалось загрузить бронирования'}</p>
        <Button onClick={() => refetch()} variant="outline">
          Попробовать снова
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Бронирования</h1>
        <p className="text-slate-600 mt-1">
          Управляйте заказами и общайтесь с клиентами
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Calendar className="h-5 w-5 text-slate-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
                <p className="text-xs text-slate-500">Всего</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                <p className="text-xs text-slate-500">Ожидают</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.confirmed}</p>
                <p className="text-xs text-slate-500">Подтверждено</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-lg">
                <DollarSign className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-teal-600">
                  {formatPrice(stats.revenue, 'THB')}
                </p>
                <p className="text-xs text-slate-500">Ваш доход</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4 mb-4">
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все бронирования</SelectItem>
            <SelectItem value="PENDING">Ожидание</SelectItem>
            <SelectItem value="CONFIRMED">Подтверждено</SelectItem>
            <SelectItem value="PAID">Оплачено</SelectItem>
            <SelectItem value="COMPLETED">Завершено</SelectItem>
            <SelectItem value="CANCELLED">Отменено</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">
          Показано: {bookings.length}
        </span>
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-slate-300 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Нет бронирований
            </h3>
            <p className="text-slate-600 text-center max-w-md">
              {filter !== 'all' 
                ? 'Нет бронирований с выбранным статусом'
                : 'Когда клиенты забронируют ваши объекты, они появятся здесь'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => {
            const statusConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.PENDING
            const StatusIcon = statusConfig.icon
            
            // Calculate nights
            const nights = booking.checkIn && booking.checkOut 
              ? differenceInDays(new Date(booking.checkOut), new Date(booking.checkIn))
              : 0
            
            // Format dates
            const formatDate = (dateStr) => {
              if (!dateStr) return 'N/A'
              try {
                return format(new Date(dateStr), 'd MMM', { locale: ru })
              } catch {
                return dateStr
              }
            }

            return (
              <Card 
                key={booking.id} 
                className="overflow-hidden hover:shadow-md transition-shadow"
                data-testid={`booking-card-${booking.id}`}
              >
                <CardContent className="p-0">
                  {/* Mobile Layout */}
                  <div className="p-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {/* Listing Image */}
                        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                          {booking.listing?.images?.[0] || booking.listing?.coverImage ? (
                            <ProxiedImage
                              src={booking.listing?.images?.[0] || booking.listing?.coverImage}
                              alt={booking.listing?.title || ''}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Home className="h-6 w-6 text-slate-300" />
                            </div>
                          )}
                        </div>
                        
                        <div className="min-w-0">
                          <h3 className="font-semibold text-slate-900 text-sm line-clamp-1">
                            {booking.listing?.title || 'Объект'}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {booking.listing?.district || 'Phuket'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Status Badge */}
                      <Badge className={`${statusConfig.color} border text-xs flex-shrink-0`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>
                    
                    {/* Guest Info */}
                    <div className="bg-slate-50 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <User className="h-4 w-4 text-slate-400" />
                        <span className="font-medium text-slate-900 text-sm">
                          {booking.guestName || 'Гость'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                        {booking.guestPhone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{booking.guestPhone}</span>
                          </div>
                        )}
                        {booking.guestEmail && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span className="truncate">{booking.guestEmail}</span>
                          </div>
                        )}
                      </div>
                      {booking.specialRequests && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <p className="text-xs text-slate-500 flex items-start gap-1.5">
                            <MessageSquare className="h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span className="italic">{booking.specialRequests}</span>
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* Dates & Price Row */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="h-4 w-4 text-teal-600" />
                        <span className="font-medium text-slate-900">
                          {formatDate(booking.checkIn)} — {formatDate(booking.checkOut)}
                        </span>
                        <span className="text-slate-400">
                          ({nights} {nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'})
                        </span>
                      </div>
                    </div>
                    
                    {/* Financial Info */}
                    <div className="flex items-center justify-between py-2 border-t border-slate-100">
                      <div>
                        <p className="text-lg font-bold text-teal-600">
                          {formatPrice(booking.partnerEarningsThb || 0, 'THB')}
                        </p>
                        <p className="text-xs text-slate-500">
                          Ваш доход ({100 - (booking.commissionRate || 15)}%)
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-700">
                          {formatPrice(booking.priceThb || 0, 'THB')}
                        </p>
                        <p className="text-xs text-slate-400">
                          Общая сумма
                        </p>
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="flex gap-2 mt-3">
                      {booking.status === 'PENDING' && (
                        <>
                          <Button
                            onClick={() => handleConfirm(booking.id)}
                            disabled={updateStatusMutation.isPending}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            data-testid={`confirm-btn-${booking.id}`}
                          >
                            {updateStatusMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-2" />
                                Подтвердить
                              </>
                            )}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => handleRejectClick(booking.id)}
                            disabled={updateStatusMutation.isPending}
                            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                            data-testid={`reject-btn-${booking.id}`}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Отклонить
                          </Button>
                        </>
                      )}
                      
                      {(booking.status === 'CONFIRMED' || booking.status === 'PAID') && (
                        <Button
                          onClick={() => handleComplete(booking.id)}
                          disabled={updateStatusMutation.isPending}
                          variant="outline"
                          className="flex-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                          data-testid={`complete-btn-${booking.id}`}
                        >
                          {updateStatusMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4 mr-2" />
                              Завершить
                            </>
                          )}
                        </Button>
                      )}
                      
                      {(booking.status === 'COMPLETED' || booking.status === 'CANCELLED') && (
                        <div className="flex-1 text-center py-2 text-sm text-slate-500">
                          {booking.status === 'COMPLETED' ? '✓ Завершено' : '✗ Отменено'}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, bookingId: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Отклонить бронирование</DialogTitle>
            <DialogDescription>
              Укажите причину отклонения (необязательно). Гость получит уведомление.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Причина отклонения..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, bookingId: null })}
            >
              Отмена
            </Button>
            <Button
              onClick={handleRejectSubmit}
              disabled={updateStatusMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {updateStatusMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Отклонить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
