'use client'

import { useState, useMemo, useRef, useCallback } from 'react'
import { format, addDays } from 'date-fns'
import { Calendar, Loader2 } from 'lucide-react'
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
 */
export function PartnerChatCalendarPeek({
  listingId,
  listingTitle,
  language = 'ru',
  triggerClassName,
  open: openControlled,
  onOpenChange: onOpenChangeControlled,
  hideTrigger = false,
}) {
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

  const onOpenChange = (next) => {
    setOpen(next)
    if (next) void load()
  }

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
        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isRu ? 'Занятость объекта' : 'Listing availability'}</SheetTitle>
            <SheetDescription className="line-clamp-2">
              {listingTitle || (isRu ? 'Выбранное объявление' : 'Selected listing')}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 min-h-[200px]">
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
              <CalendarGrid
                dates={dates}
                listings={listings}
                dayWidth={40}
                viewMode="normal"
                onCellClick={() => {}}
                todayRef={todayRef}
                scrollContainerRef={scrollRef}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
