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
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/auth-context'
import { usePartnerCalendar, useCreateBlock, useCreateManualBooking, useDeleteBlock } from '@/lib/hooks/use-partner-calendar'
import { CalendarHeader } from '@/components/calendar/CalendarHeader'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'
import { CalendarMobileAgenda } from '@/components/calendar/CalendarMobileAgenda'
import { ActionModals } from '@/components/calendar/ActionModals'
import { PartnerCalendarEducationCard } from '@/components/partner/PartnerCalendarEducationCard'
import { useMediaQuery } from '@/hooks/use-media-query'
import { detectLanguage, getUIText } from '@/lib/translations'
import { inferListingServiceTypeFromCategorySlug } from '@/lib/partner/listing-service-type'
import { getPartnerCalendarDominantHint } from '@/lib/config/partner-category-sla-hints'
import { LoadingPageShell } from '@/components/product/LoadingPageShell'
import { WorkspaceEmptyState } from '@/components/empty-state'
import { usePartnerReputationHealthQuery } from '@/hooks/use-partner-reputation-health'
import { useFxRatesQuery } from '@/lib/hooks/use-fx-rates-query'
import { postIcalSyncPartnerAll } from '@/lib/api/ical-sync-client'
import { isSoftHoldDisplayKind } from '@/lib/calendar/calendar-cell-presentation.js'
import { BLOCK_DISPLAY_KIND } from '@/lib/calendar/block-source-display.js'
import { resolvePartnerBookingStayRange } from '@/lib/calendar/partner-calendar-booking-range.js'
import { applyBulkSeasonalPrices } from '@/lib/partner/partner-calendar-bulk-prices.js'
import { usePartnerCalendarRangeSelection } from '@/lib/hooks/use-partner-calendar-range.js'

// Day width options
const DAY_WIDTHS = {
  compact: 42,
  normal: 56,
  wide: 72,
}

export default function MasterCalendar() {
  return (
    <Suspense fallback={<LoadingPageShell variant="inline" label="Loading…" />}>
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
  const showOnboarding = searchParams.get('onboarding') === 'true'
  const scrollContainerRef = useRef(null)
  const todayGridRef = useRef(null)
  const todayAgendaRef = useRef(null)
  const isNarrowCalendar = useMediaQuery('(max-width: 1023px)')
  const appliedFocusDateRef = useRef(false)
  const onboardingToastShownRef = useRef(false)
  const [onboardingBannerOpen, setOnboardingBannerOpen] = useState(showOnboarding)
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
  const [priceSubmitPending, setPriceSubmitPending] = useState(false)
  const [icalSyncing, setIcalSyncing] = useState(false)
  const queryClient = useQueryClient()
  
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
  const { data: midExchangeRates = { THB: 1 } } = useFxRatesQuery({ retail: false })
  
  const createBlockMutation = useCreateBlock()
  const createBookingMutation = useCreateManualBooking()
  const deleteBlockMutation = useDeleteBlock()

  const { clearRangeSelection, getCellRangeRole, processAvailableCellTap } =
    usePartnerCalendarRangeSelection({ language })

  useEffect(() => {
    if (!showOnboarding || onboardingToastShownRef.current || authLoading || !partnerId) return
    if (isLoading) return
    onboardingToastShownRef.current = true
    toast.success(getUIText('partnerCal_onboardingWelcomeTitle', language), {
      description: getUIText('partnerCal_onboardingWelcomeBody', language),
      duration: 12000,
    })
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('onboarding')
      window.history.replaceState({}, '', `${url.pathname}${url.search}`)
    }
  }, [showOnboarding, authLoading, partnerId, isLoading, language])

  const calendarDominantHint = useMemo(() => {
    const kind = inferListingServiceTypeFromCategorySlug(dominantCategorySlug)
    return getPartnerCalendarDominantHint(kind, language)
  }, [dominantCategorySlug, language])

  // Navigation handlers
  const goToToday = useCallback(() => {
    clearRangeSelection()
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
  }, [isNarrowCalendar, clearRangeSelection])
  
  const goBack = useCallback(() => {
    clearRangeSelection()
    setStartDate(format(subDays(parseISO(startDate), 7), 'yyyy-MM-dd'))
  }, [startDate, clearRangeSelection])
  
  const goForward = useCallback(() => {
    clearRangeSelection()
    setStartDate(format(addDays(parseISO(startDate), 7), 'yyyy-MM-dd'))
  }, [startDate, clearRangeSelection])

  const handleIcalSyncAll = useCallback(async () => {
    setIcalSyncing(true)
    try {
      const { ok, json } = await postIcalSyncPartnerAll()
      if (!ok) {
        toast.error(getUIText('partnerCal_syncAllFail', language))
        return
      }
      const count = json?.listingsSynced ?? 0
      if (count === 0) {
        toast.message(getUIText('partnerCal_syncAllEmpty', language))
      } else {
        toast.success(
          getUIText('partnerCal_syncAllSuccess', language).replace('{{count}}', String(count)),
        )
      }
      await refetch()
    } catch {
      toast.error(getUIText('partnerCal_syncAllFail', language))
    } finally {
      setIcalSyncing(false)
    }
  }, [language, refetch])
  
  const openSelectActionModal = useCallback(
    (listing, rangeStart, rangeEnd) => {
      setActionModal({
        open: true,
        type: 'select',
        listing,
        date: rangeStart,
        cellData: null,
        checkOutDate: rangeEnd,
      })
      setBlockForm({ endDate: rangeEnd, reason: '', type: 'OWNER_USE' })
      setBookingForm({
        checkOut: format(addDays(parseISO(rangeEnd), 1), 'yyyy-MM-dd'),
        guestName: '',
        guestPhone: '',
        guestEmail: '',
        priceThb: '',
        notes: '',
      })
    },
    [],
  )

  // Cell click handler
  const handleCellClick = useCallback(
    (listing, date, cellData) => {
      if (cellData.status === 'AVAILABLE') {
        const row = calendarData?.listings?.find((x) => x.listing.id === listing.id)
        const tap = processAvailableCellTap(listing, date, row?.availability)

        if (tap.action === 'open-modal' && tap.rangeStart && tap.rangeEnd) {
          openSelectActionModal(tap.listing || listing, tap.rangeStart, tap.rangeEnd)
        }
        return
      }

      clearRangeSelection()

      if (cellData.status === 'BOOKED') {
        const row = calendarData?.listings?.find((x) => x.listing.id === listing.id)
        const stay = resolvePartnerBookingStayRange(
          row?.availability,
          calendarData?.dates,
          cellData.bookingId,
        )
        setActionModal({
          open: true,
          type: 'booked-info',
          listing,
          date: stay?.checkIn || date,
          cellData,
          checkOutDate: stay?.checkOut || null,
        })
        return
      }

      if (cellData.status === 'BLOCKED') {
        if (cellData.blockKind === BLOCK_DISPLAY_KIND.ICAL) {
          setActionModal({
            open: true,
            type: 'blocked-ical',
            listing,
            date,
            cellData,
            checkOutDate: null,
          })
          return
        }
        if (
          cellData.blockKind === BLOCK_DISPLAY_KIND.MANUAL &&
          cellData.blockId &&
          !isSoftHoldDisplayKind(cellData.blockKind)
        ) {
          setActionModal({
            open: true,
            type: 'blocked-manual',
            listing,
            date,
            cellData,
            checkOutDate: null,
          })
          return
        }
        if (isSoftHoldDisplayKind(cellData.blockKind) || cellData.blockExpiresAt) {
          setActionModal({
            open: true,
            type: 'hold-info',
            listing,
            date,
            cellData,
            checkOutDate: null,
          })
        }
      }
    },
    [calendarData, processAvailableCellTap, clearRangeSelection, openSelectActionModal],
  )

  const handleUnblockSubmit = async () => {
    const blockId = actionModal.cellData?.blockId
    if (!blockId || !partnerId) return
    await deleteBlockMutation.mutateAsync({ blockId, partnerId, language })
    setActionModal({
      open: false,
      type: null,
      listing: null,
      date: null,
      cellData: null,
      checkOutDate: null,
    })
    clearRangeSelection()
  }
  
  // Submit handlers
  const handleBlockSubmit = async () => {
    if (!actionModal.listing || !actionModal.date) return
    
    await createBlockMutation.mutateAsync({
      listingId: actionModal.listing.id,
      startDate: actionModal.date,
      endDate: blockForm.endDate || actionModal.date,
      reason: blockForm.reason,
      type: blockForm.type,
      partnerId: partnerId,
      language,
    })
    
    setActionModal({ open: false, type: null, listing: null, date: null, cellData: null, checkOutDate: null })
    clearRangeSelection()
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
      partnerId: partnerId,
      language,
    })
    
    setActionModal({ open: false, type: null, listing: null, date: null, cellData: null, checkOutDate: null })
    clearRangeSelection()
  }
  
  const handlePriceSubmit = async () => {
    if (!priceForm.priceDaily || !priceForm.startDate || !priceForm.endDate || !partnerId) return

    const payload = {
      startDate: priceForm.startDate,
      endDate: priceForm.endDate,
      priceDaily: parseFloat(priceForm.priceDaily),
      seasonType: priceForm.seasonType,
      label: priceForm.label || null,
      minStay: parseInt(priceForm.minStay, 10) || 1,
    }

    const listingsToUpdate =
      priceForm.listingId === 'all'
        ? (calendarData?.listings || []).map((item) => ({
            listingId: item.listing.id,
            listingTitle: item.listing.title,
          }))
        : [
            {
              listingId: priceForm.listingId,
              listingTitle:
                calendarData?.listings?.find((x) => x.listing.id === priceForm.listingId)?.listing
                  ?.title || '',
            },
          ]

    if (listingsToUpdate.length === 0) return

    setPriceSubmitPending(true)
    try {
      await applyBulkSeasonalPrices({
        partnerId,
        listings: listingsToUpdate,
        payload,
        language,
        strategy: 'concurrent',
      })
      await queryClient.invalidateQueries({ queryKey: ['seasonal-prices'] })
      await queryClient.invalidateQueries({ queryKey: ['partner-calendar'] })
      await queryClient.invalidateQueries({ queryKey: ['partner-stats'] })

      setPriceModal({ open: false })
      setPriceForm({
        listingId: 'all',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
        priceDaily: '',
        seasonType: 'HIGH',
        label: '',
        minStay: 1,
      })
    } finally {
      setPriceSubmitPending(false)
    }
  }
  
  // Loading state
  if (authLoading || (isLoading && partnerId)) {
    return <LoadingPageShell variant="inline" label={getUIText('partnerCal_pageLoading', language)} />
  }
  
  // Not authenticated
  if (!partnerId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <Calendar className="h-12 w-12 text-slate-300 mb-4" />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">{getUIText('partnerLayout_signInBody', language)}</h2>
        <p className="text-slate-500 text-center mb-6">{getUIText('partnerLayout_redirectAfterLogin', language)}</p>
        <Button asChild variant="brand">
          <Link href="/profile?login=true">{getUIText('partnerLayout_signInCta', language)}</Link>
        </Button>
      </div>
    )
  }
  
  // Error state
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <AlertCircle className="h-12 w-12 text-red-400 mb-4" aria-hidden />
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          {getUIText('partnerCalendar_loadError', language)}
        </h2>
        <p className="text-slate-500 text-center mb-6">{error?.message}</p>
        <Button onClick={() => refetch()} variant="outline">
          {getUIText('partnerCalendar_retry', language)}
        </Button>
      </div>
    )
  }
  
  // No listings
  if (!calendarData?.listings?.length) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <WorkspaceEmptyState
          icon={Calendar}
          title={getUIText('partnerCalendar_emptyTitle', language)}
          hint={getUIText('partnerCalendar_emptyHint', language)}
          ctaLabel={getUIText('partnerCalendar_emptyCta', language)}
          ctaHref="/partner/listings/new"
        />
      </div>
    )
  }
  
  const { dates, listings, summary } = calendarData
  const dayWidth = DAY_WIDTHS[viewMode]

  return (
    <div className="max-w-full overflow-hidden space-y-4 px-2 sm:px-0">
      <PartnerCalendarEducationCard variant="calendar-page" className="max-w-[1600px] mx-auto" />
      <div className="max-w-[1600px] mx-auto flex gap-2 items-start rounded-xl border border-brand/20 bg-brand/10 px-3 py-2.5 text-xs text-brand">
        <Sparkles className="h-4 w-4 shrink-0 text-brand mt-0.5" aria-hidden />
        <p className="leading-relaxed">{calendarDominantHint}</p>
      </div>
      {openedFromChat ? (
        <div className="max-w-[1600px] mx-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          {getUIText('partnerCal_openedFromChatHint', language)}
        </div>
      ) : null}
      {onboardingBannerOpen ? (
        <Alert className="max-w-[1600px] mx-auto border-brand/30 bg-brand/10 text-brand [&>svg]:text-brand">
          <Sparkles className="h-4 w-4" aria-hidden />
          <AlertTitle>{getUIText('partnerCal_onboardingWelcomeTitle', language)}</AlertTitle>
          <AlertDescription className="text-brand-hover">
            {getUIText('partnerCal_onboardingWelcomeBody', language)}
          </AlertDescription>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 min-h-[44px] border-brand/30 text-brand-hover"
            onClick={() => setOnboardingBannerOpen(false)}
          >
            {getUIText('partnerCal_holdInfoClose', language)}
          </Button>
        </Alert>
      ) : null}
      {filterListingId ? (
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center gap-2 rounded-xl border border-brand/25 bg-brand/10 px-3 py-2.5 text-sm text-brand">
          <span className="font-medium">{getUIText('partnerCal_singleListingMode', language)}</span>
          <span className="text-brand-hover/80">{getUIText('partnerCal_singleListingHint', language)}</span>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs border-brand/30 ml-auto">
            <Link href="/partner/calendar">{getUIText('partnerCal_allListings', language)}</Link>
          </Button>
        </div>
      ) : null}
      {calendarMeta?.isDemoFallback && (
        <Alert className="max-w-[1600px] mx-auto border-amber-500/50 bg-amber-50 text-amber-950 [&>svg]:text-amber-600">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{getUIText('partnerCal_demoTitle', language)}</AlertTitle>
          <AlertDescription>
            {getUIText('partnerCal_demoBody', language)}
            {calendarMeta?.demoErrorMessage
              ? ` ${getUIText('partnerCal_demoReason', language).replace('{{reason}}', calendarMeta.demoErrorMessage)}`
              : ''}
          </AlertDescription>
        </Alert>
      )}
      <CalendarHeader
        startDate={startDate}
        endDate={endDate}
        viewMode={viewMode}
        summary={summary}
        language={language}
        onToday={goToToday}
        onBack={goBack}
        onForward={goForward}
        onViewModeChange={setViewMode}
        onRefresh={refetch}
        onIcalSyncAll={handleIcalSyncAll}
        icalSyncing={icalSyncing}
        onPriceModalOpen={() => setPriceModal({ open: true })}
      />
      
      <div className="hidden max-w-[1600px] mx-auto lg:block">
        <CalendarGrid
          dates={dates}
          listings={listings}
          dayWidth={dayWidth}
          viewMode={viewMode}
          onCellClick={handleCellClick}
          getCellRangeRole={getCellRangeRole}
          todayRef={isNarrowCalendar ? null : todayGridRef}
          scrollContainerRef={scrollContainerRef}
          language={language}
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
          getCellRangeRole={getCellRangeRole}
          todayAnchorRef={isNarrowCalendar ? todayAgendaRef : null}
          initialExpandedListingId={filterListingId || undefined}
          language={language}
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
        onUnblockSubmit={handleUnblockSubmit}
        createBlockMutation={createBlockMutation}
        createBookingMutation={createBookingMutation}
        deleteBlockMutation={deleteBlockMutation}
        priceSubmitPending={priceSubmitPending}
        onActionModalClose={clearRangeSelection}
        language={language}
        exchangeRates={midExchangeRates}
      />
    </div>
  )
}
