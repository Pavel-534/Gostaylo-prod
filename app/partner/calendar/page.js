/**
 * Gostaylo - Master Calendar (God View)
 * 
 * Multi-listing calendar grid with:
 * - Sticky listing column (left)
 * - Sticky date header (top)
 * - Color-coded booking cells
 * - Transition day indicators
 * - Quick actions (block dates, manual booking)
 * 
 * @updated 2026-03-13 - Phase 2 Implementation
 */

'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { format, addDays, subDays, parseISO, isToday, isSameDay, startOfWeek } from 'date-fns'
import { ru } from 'date-fns/locale'
import { 
  Calendar, ChevronLeft, ChevronRight, Loader2, AlertCircle,
  Plus, Lock, User, Phone, Mail, X, Check, Home, Anchor, Bike, Car,
  CalendarDays, ArrowRight, RefreshCw, ZoomIn, ZoomOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/auth-context'
import { usePartnerCalendar, useCreateBlock, useCreateManualBooking } from '@/lib/hooks/use-partner-calendar'
import { formatPrice } from '@/lib/currency'
import { cn } from '@/lib/utils'
import Link from 'next/link'

// Type icons
const TYPE_ICONS = {
  villa: Home,
  apartment: Home,
  house: Home,
  yacht: Anchor,
  bike: Bike,
  car: Car,
  default: Home
}

// Status colors
const STATUS_COLORS = {
  CONFIRMED: 'bg-teal-500 text-white',
  PENDING: 'bg-amber-400 text-amber-900',
  PAID: 'bg-emerald-500 text-white',
  BLOCKED: 'bg-slate-300 text-slate-600',
  AVAILABLE: 'bg-white hover:bg-slate-50'
}

// Day width options
const DAY_WIDTHS = {
  compact: 36,
  normal: 48,
  wide: 64
}

export default function MasterCalendar() {
  const { user, loading: authLoading, isAuthenticated } = useAuth()
  const scrollContainerRef = useRef(null)
  const todayRef = useRef(null)
  
  // Get partner ID (from auth or localStorage dev mode)
  const [partnerId, setPartnerId] = useState(null)
  
  useEffect(() => {
    // First try auth user
    if (user?.id) {
      setPartnerId(user.id)
      return
    }
    
    // Fall back to localStorage (dev mode)
    const stored = localStorage.getItem('gostaylo_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed?.id) {
          setPartnerId(parsed.id)
        }
      } catch (e) {}
    }
  }, [user])
  
  // View state
  const [viewMode, setViewMode] = useState('normal') // compact, normal, wide
  const [daysToShow, setDaysToShow] = useState(30)
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  
  // Modal state
  const [actionModal, setActionModal] = useState({
    open: false,
    type: null, // 'block' | 'booking'
    listing: null,
    date: null
  })
  
  // Form state
  const [blockForm, setBlockForm] = useState({
    endDate: '',
    reason: '',
    type: 'OWNER_USE'
  })
  
  const [bookingForm, setBookingForm] = useState({
    checkOut: '',
    guestName: '',
    guestPhone: '',
    guestEmail: '',
    priceThb: '',
    notes: ''
  })
  
  // Calculate end date
  const endDate = useMemo(() => 
    format(addDays(parseISO(startDate), daysToShow - 1), 'yyyy-MM-dd'),
    [startDate, daysToShow]
  )
  
  // TanStack Query hooks
  const { 
    data: calendarData, 
    isLoading, 
    isError, 
    error,
    refetch 
  } = usePartnerCalendar(partnerId, {
    startDate,
    endDate,
    enabled: !!partnerId
  })
  
  const createBlockMutation = useCreateBlock()
  const createBookingMutation = useCreateManualBooking()
  
  // Navigation handlers
  const goToToday = useCallback(() => {
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    // Scroll to today after data loads
    setTimeout(() => {
      todayRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center' })
    }, 100)
  }, [])
  
  const goBack = useCallback(() => {
    setStartDate(format(subDays(parseISO(startDate), 7), 'yyyy-MM-dd'))
  }, [startDate])
  
  const goForward = useCallback(() => {
    setStartDate(format(addDays(parseISO(startDate), 7), 'yyyy-MM-dd'))
  }, [startDate])
  
  // Cell click handler
  const handleCellClick = useCallback((listing, date, cellData) => {
    if (cellData.status === 'AVAILABLE') {
      setActionModal({
        open: true,
        type: 'select', // First show selection
        listing,
        date
      })
      // Reset forms
      setBlockForm({ endDate: date, reason: '', type: 'OWNER_USE' })
      setBookingForm({ 
        checkOut: format(addDays(parseISO(date), 1), 'yyyy-MM-dd'),
        guestName: '',
        guestPhone: '',
        guestEmail: '',
        priceThb: '',
        notes: ''
      })
    } else if (cellData.status === 'BOOKED') {
      // Show booking details (TODO: implement booking detail modal)
      console.log('Booking:', cellData)
    }
  }, [])
  
  // Submit handlers
  const handleBlockSubmit = async () => {
    if (!actionModal.listing || !actionModal.date) return
    
    await createBlockMutation.mutateAsync({
      listingId: actionModal.listing.id,
      startDate: actionModal.date,
      endDate: blockForm.endDate || actionModal.date,
      reason: blockForm.reason,
      type: blockForm.type,
      partnerId: partnerId
    })
    
    setActionModal({ open: false, type: null, listing: null, date: null })
  }
  
  const handleBookingSubmit = async () => {
    if (!actionModal.listing || !actionModal.date || !bookingForm.guestName) return
    
    await createBookingMutation.mutateAsync({
      listingId: actionModal.listing.id,
      checkIn: actionModal.date,
      checkOut: bookingForm.checkOut,
      guestName: bookingForm.guestName,
      guestPhone: bookingForm.guestPhone,
      guestEmail: bookingForm.guestEmail,
      priceThb: bookingForm.priceThb ? parseFloat(bookingForm.priceThb) : undefined,
      notes: bookingForm.notes,
      partnerId: partnerId
    })
    
    setActionModal({ open: false, type: null, listing: null, date: null })
  }
  
  // Loading state
  if (authLoading || (isLoading && partnerId)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">Загрузка календаря...</p>
        </div>
      </div>
    )
  }
  
  // Not authenticated - but allow if partnerId is set (dev mode)
  if (!partnerId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Calendar className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Требуется авторизация</h2>
        <p className="text-slate-500 text-center mb-6">
          Войдите в систему для просмотра календаря
        </p>
        <div className="flex gap-3">
          <Button asChild className="bg-teal-600 hover:bg-teal-700">
            <Link href="/profile?login=true">Войти</Link>
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              // Enable dev mode
              window.location.href = '/partner/calendar?devMode=true'
            }}
          >
            Dev Mode
          </Button>
        </div>
      </div>
    )
  }
  
  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Ошибка загрузки</h2>
        <p className="text-slate-500 text-center mb-6">{error?.message}</p>
        <Button onClick={() => refetch()} variant="outline">
          Попробовать снова
        </Button>
      </div>
    )
  }
  
  // No listings
  if (!calendarData?.listings?.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Calendar className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Нет объектов</h2>
        <p className="text-slate-500 text-center mb-6">
          Добавьте объекты для отображения в календаре
        </p>
        <Button asChild className="bg-teal-600 hover:bg-teal-700">
          <Link href="/partner/listings/new">
            <Plus className="h-4 w-4 mr-2" />
            Добавить объект
          </Link>
        </Button>
      </div>
    )
  }
  
  const { dates, listings, summary } = calendarData
  const dayWidth = DAY_WIDTHS[viewMode]
  
  return (
    <div className="max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-teal-600" />
            Мастер-Календарь
          </h1>
          <p className="text-slate-600 mt-1">
            {summary.totalListings} объектов • {summary.totalBookings} бронирований
          </p>
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            className="text-teal-600 border-teal-200 hover:bg-teal-50"
          >
            Сегодня
          </Button>
          
          <div className="flex items-center border rounded-lg overflow-hidden">
            <Button variant="ghost" size="sm" onClick={goBack} className="rounded-none">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-3 text-sm font-medium text-slate-700 min-w-[140px] text-center">
              {format(parseISO(startDate), 'd MMM', { locale: ru })} — {format(parseISO(endDate), 'd MMM yyyy', { locale: ru })}
            </span>
            <Button variant="ghost" size="sm" onClick={goForward} className="rounded-none">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center gap-1 border rounded-lg overflow-hidden">
            <Button 
              variant={viewMode === 'compact' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('compact')}
              className="rounded-none"
              title="Компактный вид"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'wide' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('wide')}
              className="rounded-none"
              title="Широкий вид"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            title="Обновить"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-teal-500"></div>
          <span className="text-slate-600">Подтверждено</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-amber-400"></div>
          <span className="text-slate-600">Ожидание</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-300"></div>
          <span className="text-slate-600">Заблокировано</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-dashed border-teal-400"></div>
          <span className="text-slate-600">Check-in/out</span>
        </div>
      </div>
      
      {/* Calendar Grid */}
      <Card className="overflow-hidden border-0 shadow-lg">
        <div className="relative">
          {/* Scrollable container */}
          <div 
            ref={scrollContainerRef}
            className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100"
            style={{ maxHeight: 'calc(100vh - 280px)' }}
          >
            <div className="inline-flex min-w-full">
              {/* Sticky Listing Column */}
              <div className="sticky left-0 z-20 bg-white border-r border-slate-200 shadow-sm">
                {/* Corner cell */}
                <div className="h-14 border-b border-slate-200 bg-slate-50 flex items-center justify-center px-4">
                  <span className="text-xs font-medium text-slate-500">Объект</span>
                </div>
                
                {/* Listing rows */}
                {listings.map((item) => {
                  const TypeIcon = TYPE_ICONS[item.listing.type] || TYPE_ICONS.default
                  
                  return (
                    <div 
                      key={item.listing.id}
                      className="h-16 border-b border-slate-100 flex items-center gap-3 px-3 hover:bg-slate-50 transition-colors"
                      style={{ minWidth: '200px', maxWidth: '240px' }}
                    >
                      {/* Thumbnail */}
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
                        {item.listing.coverImage ? (
                          <img 
                            src={item.listing.coverImage} 
                            alt={item.listing.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <TypeIcon className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                      </div>
                      
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-slate-900 truncate">
                          {item.listing.title}
                        </h4>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <TypeIcon className="h-3 w-3" />
                          {item.listing.district}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Date columns */}
              <div className="flex-1">
                {/* Sticky Date Header */}
                <div className="sticky top-0 z-10 flex bg-slate-50 border-b border-slate-200">
                  {dates.map((date) => {
                    const dateObj = parseISO(date)
                    const isCurrentDay = isToday(dateObj)
                    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
                    
                    return (
                      <div 
                        key={date}
                        ref={isCurrentDay ? todayRef : null}
                        className={cn(
                          "h-14 flex flex-col items-center justify-center border-r border-slate-100",
                          isCurrentDay && "bg-teal-50",
                          isWeekend && "bg-slate-100/50"
                        )}
                        style={{ width: dayWidth, minWidth: dayWidth }}
                      >
                        <span className={cn(
                          "text-[10px] uppercase",
                          isCurrentDay ? "text-teal-600 font-bold" : "text-slate-400"
                        )}>
                          {format(dateObj, 'EEE', { locale: ru })}
                        </span>
                        <span className={cn(
                          "text-sm font-medium",
                          isCurrentDay ? "text-teal-600 bg-teal-600 text-white rounded-full w-6 h-6 flex items-center justify-center" : "text-slate-700"
                        )}>
                          {format(dateObj, 'd')}
                        </span>
                      </div>
                    )
                  })}
                </div>
                
                {/* Data rows */}
                {listings.map((item) => (
                  <div key={item.listing.id} className="flex">
                    {dates.map((date) => {
                      const cellData = item.availability[date] || { status: 'AVAILABLE' }
                      const isCurrentDay = isToday(parseISO(date))
                      const isWeekend = parseISO(date).getDay() === 0 || parseISO(date).getDay() === 6
                      
                      // Determine cell appearance
                      let cellClass = STATUS_COLORS.AVAILABLE
                      let content = null
                      
                      if (cellData.status === 'BOOKED') {
                        cellClass = STATUS_COLORS[cellData.bookingStatus] || STATUS_COLORS.CONFIRMED
                        
                        // Show guest name (truncated for first day)
                        if (cellData.isCheckIn || viewMode === 'wide') {
                          content = (
                            <span className="text-[9px] leading-tight truncate px-0.5">
                              {cellData.guestName?.split(' ')[0] || 'Гость'}
                            </span>
                          )
                        }
                      } else if (cellData.status === 'BLOCKED') {
                        cellClass = STATUS_COLORS.BLOCKED
                        if (viewMode === 'wide') {
                          content = (
                            <Lock className="h-3 w-3 text-slate-500" />
                          )
                        }
                      }
                      
                      return (
                        <div
                          key={date}
                          onClick={() => handleCellClick(item.listing, date, cellData)}
                          className={cn(
                            "h-16 border-r border-b border-slate-100 flex items-center justify-center cursor-pointer transition-all",
                            cellClass,
                            isCurrentDay && "ring-2 ring-inset ring-teal-400",
                            isWeekend && cellData.status === 'AVAILABLE' && "bg-slate-50",
                            cellData.isTransition && "border-l-2 border-l-dashed border-l-teal-400",
                            cellData.isCheckIn && "rounded-l",
                            cellData.isCheckOut && "rounded-r"
                          )}
                          style={{ width: dayWidth, minWidth: dayWidth }}
                          title={cellData.status === 'BOOKED' 
                            ? `${cellData.guestName} (${cellData.bookingStatus})`
                            : cellData.status === 'BLOCKED'
                            ? cellData.reason
                            : 'Доступно - нажмите для действия'
                          }
                        >
                          {content}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>
      
      {/* Action Modal */}
      <Dialog 
        open={actionModal.open} 
        onOpenChange={(open) => setActionModal(prev => ({ ...prev, open }))}
      >
        <DialogContent className="sm:max-w-[425px]">
          {/* Selection View */}
          {actionModal.type === 'select' && (
            <>
              <DialogHeader>
                <DialogTitle>Выберите действие</DialogTitle>
                <DialogDescription>
                  {actionModal.listing?.title} • {actionModal.date && format(parseISO(actionModal.date), 'd MMMM yyyy', { locale: ru })}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-3 py-4">
                <Button
                  variant="outline"
                  className="h-auto py-4 justify-start"
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'block' }))}
                >
                  <Lock className="h-5 w-5 mr-3 text-slate-500" />
                  <div className="text-left">
                    <div className="font-medium">Заблокировать даты</div>
                    <div className="text-xs text-slate-500">Для обслуживания или личного использования</div>
                  </div>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto py-4 justify-start"
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'booking' }))}
                >
                  <User className="h-5 w-5 mr-3 text-teal-600" />
                  <div className="text-left">
                    <div className="font-medium">Создать бронирование</div>
                    <div className="text-xs text-slate-500">Для офлайн продаж</div>
                  </div>
                </Button>
              </div>
            </>
          )}
          
          {/* Block Form */}
          {actionModal.type === 'block' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-slate-500" />
                  Заблокировать даты
                </DialogTitle>
                <DialogDescription>
                  {actionModal.listing?.title}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Начало</Label>
                    <Input 
                      type="date" 
                      value={actionModal.date || ''} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Конец</Label>
                    <Input 
                      type="date" 
                      value={blockForm.endDate}
                      min={actionModal.date}
                      onChange={(e) => setBlockForm(prev => ({ ...prev, endDate: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Тип блокировки</Label>
                  <Select 
                    value={blockForm.type} 
                    onValueChange={(v) => setBlockForm(prev => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OWNER_USE">Личное использование</SelectItem>
                      <SelectItem value="MAINTENANCE">Техническое обслуживание</SelectItem>
                      <SelectItem value="OTHER">Другое</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Причина (необязательно)</Label>
                  <Textarea
                    value={blockForm.reason}
                    onChange={(e) => setBlockForm(prev => ({ ...prev, reason: e.target.value }))}
                    placeholder="Укажите причину блокировки..."
                    className="mt-1"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'select' }))}
                >
                  Назад
                </Button>
                <Button 
                  onClick={handleBlockSubmit}
                  disabled={createBlockMutation.isPending}
                  className="bg-slate-600 hover:bg-slate-700"
                >
                  {createBlockMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Lock className="h-4 w-4 mr-2" />
                  )}
                  Заблокировать
                </Button>
              </DialogFooter>
            </>
          )}
          
          {/* Manual Booking Form */}
          {actionModal.type === 'booking' && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-teal-600" />
                  Создать бронирование
                </DialogTitle>
                <DialogDescription>
                  {actionModal.listing?.title}
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Заезд</Label>
                    <Input 
                      type="date" 
                      value={actionModal.date || ''} 
                      disabled 
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Выезд *</Label>
                    <Input 
                      type="date" 
                      value={bookingForm.checkOut}
                      min={actionModal.date}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, checkOut: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Имя гостя *</Label>
                  <Input 
                    value={bookingForm.guestName}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, guestName: e.target.value }))}
                    placeholder="Иван Петров"
                    className="mt-1"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Телефон</Label>
                    <Input 
                      type="tel"
                      value={bookingForm.guestPhone}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, guestPhone: e.target.value }))}
                      placeholder="+7 999 123 4567"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={bookingForm.guestEmail}
                      onChange={(e) => setBookingForm(prev => ({ ...prev, guestEmail: e.target.value }))}
                      placeholder="email@example.com"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label>Сумма (THB)</Label>
                  <Input 
                    type="number"
                    value={bookingForm.priceThb}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, priceThb: e.target.value }))}
                    placeholder={`Базовая цена: ${formatPrice(actionModal.listing?.basePriceThb || 0, 'THB')}/ночь`}
                    className="mt-1"
                  />
                </div>
                
                <div>
                  <Label>Заметки</Label>
                  <Textarea
                    value={bookingForm.notes}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Дополнительная информация..."
                    className="mt-1"
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setActionModal(prev => ({ ...prev, type: 'select' }))}
                >
                  Назад
                </Button>
                <Button 
                  onClick={handleBookingSubmit}
                  disabled={createBookingMutation.isPending || !bookingForm.guestName || !bookingForm.checkOut}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {createBookingMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  Создать
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
