/**
 * Gostaylo - Master Calendar (God View)
 * Refactored for Clean Code Architecture - Phase 7.5
 * 
 * @refactored 2026-03-17 - Modular Component Structure
 */

'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { Calendar, Loader2, AlertCircle, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { usePartnerCalendar, useCreateBlock, useCreateManualBooking } from '@/lib/hooks/use-partner-calendar'
import { useUpsertSeasonalPrice } from '@/lib/hooks/use-seasonal-prices'
import { CalendarHeader } from '@/components/calendar/CalendarHeader'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { ActionModals } from '@/components/calendar/ActionModals'

// Day width options
const DAY_WIDTHS = {
  compact: 36,
  normal: 48,
  wide: 64
}

export default function MasterCalendar() {
  const { user, loading: authLoading } = useAuth()
  const scrollContainerRef = useRef(null)
  const todayRef = useRef(null)
  
  // Get partner ID (useAuth or localStorage fallback)
  const [partnerId, setPartnerId] = useState(null)
  
  useEffect(() => {
    if (user?.id) {
      setPartnerId(user.id)
      return
    }
    const stored = localStorage.getItem('gostaylo_user')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed?.id) setPartnerId(parsed.id)
      } catch (e) {}
    }
  }, [user?.id])
  
  // View state
  const [viewMode, setViewMode] = useState('normal')
  const [daysToShow, setDaysToShow] = useState(30)
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  
  // Modal state
  const [actionModal, setActionModal] = useState({
    open: false,
    type: null,
    listing: null,
    date: null
  })
  
  const [priceModal, setPriceModal] = useState({ open: false })
  
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
  
  const [priceForm, setPriceForm] = useState({
    listingId: 'all',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
    priceDaily: '',
    seasonType: 'HIGH',
    label: '',
    minStay: 1
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
  const upsertSeasonalPriceMutation = useUpsertSeasonalPrice()
  
  // Navigation handlers
  const goToToday = useCallback(() => {
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
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
        type: 'select',
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
  
  const handlePriceSubmit = async () => {
    if (!priceForm.priceDaily || !priceForm.startDate || !priceForm.endDate) return
    
    if (priceForm.listingId === 'all') {
      const listingsToUpdate = calendarData?.listings || []
      for (const item of listingsToUpdate) {
        await upsertSeasonalPriceMutation.mutateAsync({
          listingId: item.listing.id,
          startDate: priceForm.startDate,
          endDate: priceForm.endDate,
          priceDaily: parseFloat(priceForm.priceDaily),
          seasonType: priceForm.seasonType,
          label: priceForm.label || null,
          minStay: parseInt(priceForm.minStay) || 1,
          partnerId: partnerId
        })
      }
    } else {
      await upsertSeasonalPriceMutation.mutateAsync({
        listingId: priceForm.listingId,
        startDate: priceForm.startDate,
        endDate: priceForm.endDate,
        priceDaily: parseFloat(priceForm.priceDaily),
        seasonType: priceForm.seasonType,
        label: priceForm.label || null,
        minStay: parseInt(priceForm.minStay) || 1,
        partnerId: partnerId
      })
    }
    
    setPriceModal({ open: false })
    setPriceForm({
      listingId: 'all',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      priceDaily: '',
      seasonType: 'HIGH',
      label: '',
      minStay: 1
    })
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
  
  // Not authenticated
  if (!partnerId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Calendar className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Требуется авторизация</h2>
        <p className="text-slate-500 text-center mb-6">Войдите в систему для просмотра календаря</p>
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
        <p className="text-slate-500 text-center mb-6">{error?.message}</p>
        <Button onClick={() => refetch()} variant="outline">Попробовать снова</Button>
      </div>
    )
  }
  
  // No listings
  if (!calendarData?.listings?.length) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Calendar className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">Нет объектов</h2>
        <p className="text-slate-500 text-center mb-6">Добавьте объекты для отображения в календаре</p>
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
      <CalendarHeader
        startDate={startDate}
        endDate={endDate}
        viewMode={viewMode}
        summary={summary}
        onToday={goToToday}
        onBack={goBack}
        onForward={goForward}
        onViewModeChange={setViewMode}
        onRefresh={refetch}
        onPriceModalOpen={() => setPriceModal({ open: true })}
      />
      
      <CalendarGrid
        dates={dates}
        listings={listings}
        dayWidth={dayWidth}
        viewMode={viewMode}
        onCellClick={handleCellClick}
        todayRef={todayRef}
        scrollContainerRef={scrollContainerRef}
      />
      
      <ActionModals
        actionModal={actionModal}
        setActionModal={setActionModal}
        blockForm={blockForm}
        setBlockForm={setBlockForm}
        bookingForm={bookingForm}
        setBookingForm={setBookingForm}
        priceModal={priceModal}
        setPriceModal={setPriceModal}
        priceForm={priceForm}
        setPriceForm={setPriceForm}
        listings={listings}
        onBlockSubmit={handleBlockSubmit}
        onBookingSubmit={handleBookingSubmit}
        onPriceSubmit={handlePriceSubmit}
        createBlockMutation={createBlockMutation}
        createBookingMutation={createBookingMutation}
        upsertSeasonalPriceMutation={upsertSeasonalPriceMutation}
      />
    </div>
  )
}
