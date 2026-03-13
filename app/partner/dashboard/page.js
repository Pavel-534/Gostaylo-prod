/**
 * Gostaylo - Premium Partner Dashboard (Phase 3)
 * 
 * "God View" with:
 * - Revenue Widget with sparkline
 * - Occupancy Radial progress
 * - Today's Summary
 * - Pending Actions
 * - Upcoming Arrivals Feed
 * - Quick Actions
 * 
 * @updated 2026-03-13 - Phase 3 Implementation
 */

'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO, differenceInDays } from 'date-fns'
import { ru } from 'date-fns/locale'
import { useQueryClient } from '@tanstack/react-query'
import { 
  TrendingUp, TrendingDown, Calendar, DollarSign, Users, 
  Home, Clock, Check, X, ArrowRight, Plus, Lock, Download,
  Loader2, AlertCircle, ChevronRight, UserCheck, UserMinus,
  CalendarDays, BarChart3, RefreshCw, Bell
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { usePartnerStats, partnerStatsKeys } from '@/lib/hooks/use-partner-stats'
import { useUpdateBookingStatus, partnerBookingsKeys } from '@/lib/hooks/use-partner-bookings'
import { partnerCalendarKeys } from '@/lib/hooks/use-partner-calendar'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

// Shimmer Loading Skeleton
function Skeleton({ className }) {
  return (
    <div className={cn(
      "animate-pulse bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] rounded",
      className
    )} />
  )
}

// Revenue Sparkline Chart (SVG)
function Sparkline({ data, color = '#0d9488', height = 40 }) {
  if (!data || data.length === 0) return null
  
  const max = Math.max(...data.map(d => d.revenue), 1)
  const width = 120
  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (d.revenue / max) * (height - 4)
    return `${x},${y}`
  }).join(' ')
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="sparklineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      <polygon
        fill="url(#sparklineGradient)"
        points={`0,${height} ${points} ${width},${height}`}
      />
    </svg>
  )
}

// Circular Progress (Occupancy Radial)
function OccupancyRadial({ rate, size = 120 }) {
  const strokeWidth = 10
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (rate / 100) * circumference
  
  const getColor = (rate) => {
    if (rate >= 80) return '#0d9488' // teal-600
    if (rate >= 50) return '#f59e0b' // amber-500
    return '#ef4444' // red-500
  }
  
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor(rate)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-slate-900">{rate}%</span>
        <span className="text-xs text-slate-500">загрузка</span>
      </div>
    </div>
  )
}

// Pending Booking Card with Approve/Decline
function PendingBookingCard({ booking, onApprove, onDecline, isLoading }) {
  return (
    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">{booking.guestName}</p>
        <p className="text-xs text-slate-500 truncate">{booking.listingTitle}</p>
        <p className="text-xs text-amber-600 mt-0.5">
          {booking.checkIn && format(parseISO(booking.checkIn), 'd MMM', { locale: ru })} • {formatPrice(booking.priceThb, 'THB')}
        </p>
      </div>
      <div className="flex gap-1.5 ml-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-green-600 hover:bg-green-100"
          onClick={() => onApprove(booking.id)}
          disabled={isLoading}
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-red-600 hover:bg-red-100"
          onClick={() => onDecline(booking.id)}
          disabled={isLoading}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

export default function PartnerDashboard() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [partnerId, setPartnerId] = useState(null)
  
  // Get partner ID from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('gostaylo_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setPartnerId(parsed.id)
      } catch (e) {}
    }
  }, [])
  
  // TanStack Query hooks
  const { data: stats, isLoading, isError, refetch } = usePartnerStats(partnerId, {
    enabled: !!partnerId
  })
  
  // Mutation for booking status updates
  const updateStatusMutation = useUpdateBookingStatus()
  
  // Handle approve booking - REACTIVE: invalidates calendar and stats
  const handleApprove = async (bookingId) => {
    try {
      await updateStatusMutation.mutateAsync({
        bookingId,
        status: 'CONFIRMED',
        partnerId
      })
      
      // Invalidate all related queries for instant UI update
      queryClient.invalidateQueries({ queryKey: partnerStatsKeys.all })
      queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
      queryClient.invalidateQueries({ queryKey: partnerBookingsKeys.all })
      
      toast.success('Бронирование подтверждено!')
    } catch (error) {
      toast.error('Ошибка при подтверждении')
    }
  }
  
  // Handle decline booking
  const handleDecline = async (bookingId) => {
    try {
      await updateStatusMutation.mutateAsync({
        bookingId,
        status: 'CANCELLED',
        reason: 'Отклонено партнёром',
        partnerId
      })
      
      queryClient.invalidateQueries({ queryKey: partnerStatsKeys.all })
      queryClient.invalidateQueries({ queryKey: partnerCalendarKeys.all })
      queryClient.invalidateQueries({ queryKey: partnerBookingsKeys.all })
      
      toast.success('Бронирование отклонено')
    } catch (error) {
      toast.error('Ошибка при отклонении')
    }
  }
  
  // Loading state with skeletons
  if (isLoading || !partnerId) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-28 mb-2" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent>
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full mb-2" />)}
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent>
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full mb-2" />)}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  
  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Ошибка загрузки</h2>
        <Button onClick={() => refetch()} variant="outline">Повторить</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-teal-600" />
            Обзор бизнеса
          </h1>
          <p className="text-slate-600 mt-1">
            {format(new Date(), 'EEEE, d MMMM yyyy', { locale: ru })}
          </p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button 
            asChild 
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Link href="/partner/listings/new">
              <Plus className="h-4 w-4 mr-2" />
              Новый объект
            </Link>
          </Button>
          <Button 
            variant="outline" 
            asChild
          >
            <Link href="/partner/calendar">
              <Lock className="h-4 w-4 mr-2" />
              Блокировать даты
            </Link>
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => refetch()}
            title="Обновить"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Today's Summary Banner */}
      {(stats?.today?.checkIns > 0 || stats?.today?.checkOuts > 0) && (
        <Card className="bg-gradient-to-r from-teal-500 to-teal-600 border-0 text-white">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5" />
                  <span className="font-medium">{stats.today.checkIns} заезд(ов)</span>
                </div>
                <div className="flex items-center gap-2">
                  <UserMinus className="h-5 w-5" />
                  <span className="font-medium">{stats.today.checkOuts} выезд(ов)</span>
                </div>
              </div>
              <Badge variant="secondary" className="bg-white/20 text-white border-0">
                Сегодня
              </Badge>
            </div>
            {stats.today.checkInsList?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/20">
                <p className="text-sm text-white/80">
                  Заезды: {stats.today.checkInsList.map(c => c.guestName).join(', ')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue Widget */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">Доход (ваш)</span>
              <DollarSign className="h-4 w-4 text-teal-600" />
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {formatPrice(stats?.revenue?.confirmed || 0, 'THB')}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  +{formatPrice(stats?.revenue?.pending || 0, 'THB')} ожидает
                </p>
              </div>
              <Sparkline data={stats?.revenue?.trend} color="#0d9488" height={40} />
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-green-600">+12% за неделю</span>
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Widget */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">Загрузка (месяц)</span>
              <Calendar className="h-4 w-4 text-teal-600" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-slate-900">
                  {stats?.occupancy?.rate || 0}%
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {stats?.occupancy?.listingsCount || 0} объектов
                </p>
              </div>
              <OccupancyRadial rate={stats?.occupancy?.rate || 0} size={80} />
            </div>
          </CardContent>
        </Card>

        {/* Pending Actions Widget */}
        <Card className={cn(
          "border-0 shadow-sm hover:shadow-md transition-shadow",
          stats?.pending?.count > 0 && "ring-2 ring-amber-400"
        )}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">Ожидают действия</span>
              <Bell className={cn("h-4 w-4", stats?.pending?.count > 0 ? "text-amber-500 animate-pulse" : "text-slate-400")} />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {stats?.pending?.count || 0}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              новых запросов
            </p>
            {stats?.pending?.count > 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                className="mt-2 w-full text-amber-600 border-amber-300 hover:bg-amber-50"
                asChild
              >
                <Link href="/partner/bookings">
                  Просмотреть
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Bookings Summary Widget */}
        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-slate-500">Бронирования</span>
              <Users className="h-4 w-4 text-teal-600" />
            </div>
            <p className="text-2xl font-bold text-slate-900">
              {stats?.bookings?.total || 0}
            </p>
            <div className="flex gap-3 mt-2 text-xs">
              <span className="text-teal-600">✓ {stats?.bookings?.confirmed || 0}</span>
              <span className="text-amber-600">◔ {stats?.bookings?.pending || 0}</span>
              <span className="text-slate-400">✓✓ {stats?.bookings?.completed || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Approvals */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Ожидают подтверждения
                </CardTitle>
                <CardDescription>Подтвердите или отклоните запросы</CardDescription>
              </div>
              {stats?.pending?.count > 0 && (
                <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                  {stats.pending.count}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats?.pending?.items?.length > 0 ? (
              stats.pending.items.map(booking => (
                <PendingBookingCard
                  key={booking.id}
                  booking={booking}
                  onApprove={handleApprove}
                  onDecline={handleDecline}
                  isLoading={updateStatusMutation.isPending}
                />
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
                <p>Все запросы обработаны!</p>
              </div>
            )}
            
            {stats?.pending?.count > 3 && (
              <Button variant="ghost" className="w-full mt-2" asChild>
                <Link href="/partner/bookings">
                  Показать все ({stats.pending.count})
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Arrivals */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-teal-600" />
                  Ближайшие заезды
                </CardTitle>
                <CardDescription>Следующие 7 дней</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/partner/calendar">
                  Календарь
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {stats?.upcoming?.length > 0 ? (
              <div className="space-y-3">
                {stats.upcoming.map((arrival, idx) => (
                  <div 
                    key={arrival.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex-shrink-0 w-10 h-10 bg-teal-100 rounded-lg flex flex-col items-center justify-center">
                      <span className="text-xs font-bold text-teal-700">
                        {arrival.checkIn && format(parseISO(arrival.checkIn), 'd')}
                      </span>
                      <span className="text-[10px] text-teal-600 uppercase">
                        {arrival.checkIn && format(parseISO(arrival.checkIn), 'MMM', { locale: ru })}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 truncate">{arrival.guestName}</p>
                      <p className="text-xs text-slate-500 truncate">
                        {arrival.listingTitle} • {arrival.nights} {arrival.nights === 1 ? 'ночь' : arrival.nights < 5 ? 'ночи' : 'ночей'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-teal-600">
                        {formatPrice(arrival.priceThb, 'THB')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                <p>Нет заездов на ближайшие дни</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-slate-50 to-slate-100">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 justify-center">
            <Button variant="outline" asChild>
              <Link href="/partner/listings">
                <Home className="h-4 w-4 mr-2" />
                Мои объекты
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/partner/calendar">
                <CalendarDays className="h-4 w-4 mr-2" />
                Мастер-Календарь
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/partner/bookings">
                <Users className="h-4 w-4 mr-2" />
                Все бронирования
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/partner/finances">
                <DollarSign className="h-4 w-4 mr-2" />
                Финансы
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
