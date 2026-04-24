/**
 * GoStayLo - Master Calendar (God View)
 * Refactored for Clean Code Architecture - Phase 7.5
 * 
 * @refactored 2026-03-17 - Modular Component Structure
 */

'use client'

import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react'
import { format, addDays, subDays, parseISO } from 'date-fns'
import { Calendar, Loader2, AlertCircle, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { usePartnerCalendar, useCreateBlock, useCreateManualBooking } from '@/lib/hooks/use-partner-calendar'
import { useUpsertSeasonalPrice } from '@/lib/hooks/use-seasonal-prices'
import { CalendarHeader } from '@/components/calendar/CalendarHeader'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { CalendarMobileAgenda } from '@/components/calendar/CalendarMobileAgenda'
import { ActionModals } from '@/components/calendar/ActionModals'
import { PartnerCalendarEducationCard } from '@/components/partner/PartnerCalendarEducationCard'
import { useMediaQuery } from '@/hooks/use-media-query'
import { detectLanguage, getUIText } from '@/lib/translations'
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'
import { getPartnerCalendarDominantHint } from '@/lib/config/partner-category-sla-hints'
import { usePartnerReputationHealthQuery } from '@/hooks/use-partner-reputation-health'

// Day width options
const DAY_WIDTHS = {
  compact: 42,
  normal: 56,
  wide: 72,
}

export default function MasterCalendar() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <MasterCalendarContent />
    </Suspense>
  )
}

function MasterCalendarContent() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  const filterListingId = searchParams.get('listingId') || searchParams.get('listing_id') || ''
  const focusDateFromChat = searchParams.get('focusDate') || searchParams.get('date') || ''
  const openedFromChat = searchParams.get('from') === 'chat'
  const scrollContainerRef = useRef(null)
  const todayGridRef = useRef(null)
  const todayAgendaRef = useRef(null)
  const isNarrowCalendar = useMediaQuery('(max-width: 1023px)')
  const appliedFocusDateRef = useRef(false)
  const [language, setLanguage] = useState('ru')

  useEffect(() => {
    const lang = detectLanguage()
    setLanguage(lang)
    const h = (e) => {
      if (e?.detail) setLanguage(e.detail)
    }
    window.addEventListener('language-change', h)
    window.addEventListener('languageChange', h)
    return () => {
      window.removeEventListener('language-change', h)
      window.removeEventListener('languageChange', h)
    }
  }, [])
  
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
      } catch {
        /* ignore */
      }
    }
  }, [user?.id])

  const { data: reputationHealthData } = usePartnerReputationHealthQuery(!!partnerId)
  const dominantCategorySlug = reputationHealthData?.dominantCategorySlug ?? null

  // View state
  const [viewMode, setViewMode] = useState('normal')
  const [daysToShow] = useState(30)
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  // Переход из чата: ?focusDate=YYYY-MM-DD — показать окно с этой датой в видимой полосе
  useEffect(() => {
    if (appliedFocusDateRef.current) return
    if (!focusDateFromChat || !/^\d{4}-\d{2}-\d{2}$/.test(focusDateFromChat)) return
    try {
      const d = parseISO(focusDateFromChat)
      if (Number.isNaN(d.getTime())) return
      appliedFocusDateRef.current = true
      setStartDate(format(subDays(d, 5), 'yyyy-MM-dd'))
    } catch {
      /* ignore */
    }
  }, [focusDateFromChat])
  
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
    meta: calendarMeta,
    isLoading, 
    isError, 
    error,
    refetch 
  } = usePartnerCalendar(partnerId, {
    startDate,
    endDate,
    listingId: filterListingId || null,
    enabled: !!partnerId
  })
  
  const createBlockMutation = useCreateBlock()
  const createBookingMutation = useCreateManualBooking()
  const upsertSeasonalPriceMutation = useUpsertSeasonalPrice()

  const calendarDominantHint = useMemo(() => {
    const kind = inferListingServiceTypeFromCategorySlug(dominantCategorySlug)
    return getPartnerCalendarDominantHint(kind, language)
  }, [dominantCategorySlug, language])

  // Navigation handlers
  const goToToday = useCallback(() => {
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    window.requestAnimationFrame(() => {
      setTimeout(() => {
        const el = isNarrowCalendar ? todayAgendaRef.current : todayGridRef.current
        el?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest',
        })
      }, 280)
    })
  }, [isNarrowCalendar])
  
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
      /* booked cell — detail drill-down can be added here */
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
    <div className="max-w-full overflow-hidden space-y-4 px-2 sm:px-0">
      <PartnerCalendarEducationCard variant="calendar-page" className="max-w-[1600px] mx-auto" />
      <div className="max-w-[1600px] mx-auto flex gap-2 items-start rounded-xl border border-teal-100 bg-teal-50/50 px-3 py-2.5 text-xs text-teal-950">
        <Sparkles className="h-4 w-4 shrink-0 text-teal-600 mt-0.5" aria-hidden />
        <p className="leading-relaxed">{calendarDominantHint}</p>
      </div>
      {openedFromChat ? (
        <div className="max-w-[1600px] mx-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          Вы перешли из чата — здесь можно заблокировать даты, создать ручную бронь или изменить цену по ячейке.
        </div>
      ) : null}
      {filterListingId ? (
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/90 px-3 py-2.5 text-sm text-teal-900">
          <span className="font-medium">Режим: один объект</span>
          <span className="text-teal-700/80">даты и цены только для выбранного листинга</span>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs border-teal-300 ml-auto">
            <Link href="/partner/calendar">Все объекты</Link>
          </Button>
        </div>
      ) : null}
      {calendarMeta?.isDemoFallback && (
        <Alert className="max-w-[1600px] mx-auto border-amber-500/50 bg-amber-50 text-amber-950 [&>svg]:text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Демо-режим</AlertTitle>
          <AlertDescription>
            API календаря недоступен. Показаны демо-данные (NEXT_PUBLIC_PARTNER_CALENDAR_DEMO_FALLBACK=1).
            {calendarMeta?.demoErrorMessage ? ` Причина: ${calendarMeta.demoErrorMessage}` : ''}
          </AlertDescription>
        </Alert>
      )}
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
      
      <div className="hidden max-w-[1600px] mx-auto lg:block">
        <CalendarGrid
          dates={dates}
          listings={listings}
          dayWidth={dayWidth}
          viewMode={viewMode}
          onCellClick={handleCellClick}
          todayRef={isNarrowCalendar ? null : todayGridRef}
          scrollContainerRef={scrollContainerRef}
        />
      </div>

      <div className="mx-auto max-w-[1600px] lg:hidden">
        <p className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {getUIText('partnerCal_agendaHint', language)}
        </p>
        <CalendarMobileAgenda
          dates={dates}
          listings={listings}
          onCellClick={handleCellClick}
          todayAnchorRef={isNarrowCalendar ? todayAgendaRef : null}
          initialExpandedListingId={filterListingId || undefined}
        />
      </div>
      
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
        language={language}
        exchangeRates={{ THB: 1 }}
      />
    </div>
  )
}
