'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import { Calendar, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { CalendarGrid } from '@/components/calendar/CalendarGrid'

/**
 * Быстрый просмотр занятости одного листинга из шапки чата (без ухода со страницы).
 * Клик по ячейке ведёт в полный календарь партнёра / на страницу объекта (рентер).
 *
 * @param {'partner'|'renter'} [props.mode] — partner: /partner/calendar; renter: /listings/:id
 */
export function PartnerChatCalendarPeek({
  listingId,
  listingTitle,
  language = 'ru',
  triggerClassName,
  open: openControlled,
  onOpenChange: onOpenChangeControlled,
  hideTrigger = false,
  mode = 'partner',
}) {
  const router = useRouter()
  const [openInternal, setOpenInternal] = useState(false)
  const isControlled = openControlled !== undefined
  const open = isControlled ? openControlled : openInternal
  const setOpen = useCallback(
    (next) => {
      onOpenChangeControlled?.(next)
      if (!isControlled) setOpenInternal(next)
    },
    [isControlled, onOpenChangeControlled]
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [calendarPayload, setCalendarPayload] = useState(null)
  const scrollRef = useRef(null)
  const todayRef = useRef(null)

  const startDate = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const endDate = useMemo(() => format(addDays(new Date(), 44), 'yyyy-MM-dd'), [])

  const load = useCallback(async () => {
    if (!listingId) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        listingId,
        startDate,
        endDate,
      })
      const res = await fetch(`/api/v2/partner/calendar?${params}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok || json.status === 'error') {
        throw new Error(json.error || 'Calendar error')
      }
      setCalendarPayload(json.data || null)
    } catch (e) {
      setError(e.message || 'Failed to load')
      setCalendarPayload(null)
    } finally {
      setLoading(false)
    }
  }, [listingId, startDate, endDate])

  /**
   * Контролируемое open из родителя (кнопка в DealDetailsCard) не всегда вызывает
   * onOpenChange(true) у Radix Sheet — без этого load() не запускался и показывалось «Нет данных».
   */
  useEffect(() => {
    if (!open || !listingId) return
    void load()
  }, [open, listingId, load])

  const onOpenChange = (next) => {
    setOpen(next)
  }

  const handleCellClick = useCallback(
    (listing, date) => {
      if (!listing?.id) return
      setOpen(false)
      if (mode === 'renter') {
        router.push(`/listings/${listing.id}`)
        return
      }
      const q = new URLSearchParams({
        listingId: listing.id,
        from: 'chat',
      })
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        q.set('focusDate', date)
      }
      router.push(`/partner/calendar?${q.toString()}`)
    },
    [mode, router, setOpen],
  )

  const isRu = language !== 'en'
  const dates = calendarPayload?.dates || []
  const listings = calendarPayload?.listings || []

  return (
    <>
      {!hideTrigger && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={triggerClassName}
          title={isRu ? 'Календарь объекта' : 'Listing calendar'}
          onClick={() => onOpenChange(true)}
          disabled={!listingId}
        >
          <Calendar className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">{isRu ? 'Календарь' : 'Calendar'}</span>
        </Button>
      )}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-3xl"
        >
          <SheetHeader className="shrink-0 space-y-1 pr-8 text-left">
            <SheetTitle>{isRu ? 'Занятость объекта' : 'Listing availability'}</SheetTitle>
            <SheetDescription className="line-clamp-2">
              {listingTitle || (isRu ? 'Выбранное объявление' : 'Selected listing')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                {isRu ? 'Загрузка…' : 'Loading…'}
              </div>
            ) : error ? (
              <p className="text-sm text-red-600 py-6">{error}</p>
            ) : listings.length === 0 ? (
              <p className="text-sm text-slate-600 py-6">
                {isRu ? 'Нет данных календаря для этого объекта.' : 'No calendar rows for this listing.'}
              </p>
            ) : (
              <>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {mode === 'renter'
                    ? isRu
                      ? 'Нажмите на день, чтобы открыть страницу объекта и забронировать.'
                      : 'Tap a day to open the listing and book.'
                    : isRu
                      ? 'Нажмите на день — откроется полный календарь: блокировка дат, ручная бронь и цены.'
                      : 'Click a day to open the full calendar: block dates, manual booking, and prices.'}
                </p>
                <div className="min-h-0 flex-1">
                  <CalendarGrid
                    dates={dates}
                    listings={listings}
                    dayWidth={40}
                    viewMode="normal"
                    onCellClick={handleCellClick}
                    todayRef={todayRef}
                    scrollContainerRef={scrollRef}
                    scrollMaxHeight="min(58vh, 480px)"
                  />
                </div>
              </>
            )}

            {listingId && !loading && !error && listings.length > 0 ? (
              <div className="shrink-0 space-y-2 border-t border-slate-200 pt-4 pb-2">
                <p className="text-[11px] text-slate-500 leading-snug">
                  {mode === 'renter'
                    ? isRu
                      ? 'Управление ценами и бронями — у владельца в кабинете партнёра.'
                      : 'Pricing and bookings are managed by the host in the partner dashboard.'
                    : isRu
                      ? 'В чате только просмотр. Все действия с датами — в разделе «Календарь».'
                      : 'This panel is read-only. Manage dates in the Calendar section.'}
                </p>
                {mode === 'partner' ? (
                  <Button asChild className="w-full bg-teal-600 hover:bg-teal-700 sm:w-auto">
                    <Link href={`/partner/calendar?listingId=${encodeURIComponent(listingId)}&from=chat`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {isRu ? 'Открыть полный календарь' : 'Open full calendar'}
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="w-full sm:w-auto">
                    <Link href={listingId ? `/listings/${listingId}` : '#'}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      {isRu ? 'Страница объекта' : 'Listing page'}
                    </Link>
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
