'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { format, addDays } from 'date-fns'
import { Calendar, ExternalLink, Loader2, Receipt } from 'lucide-react'
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
import { CalendarMobileAgenda } from '@/components/calendar/CalendarMobileAgenda'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { PartnerFinancialSnapshotDialog } from '@/components/partner/PartnerFinancialSnapshotDialog'

/** Кнопка «Финансы брони» только при наличии read-model в треде (нет снапшота — старые тестовые брони). */
function hasUsableFinancialSnapshot(snap) {
  if (snap == null || typeof snap !== 'object' || Array.isArray(snap)) return false
  return (
    snap.partnerPayoutThb != null ||
    snap.net != null ||
    snap.gross != null ||
    snap.fee != null
  )
}

/**
 * Быстрый просмотр занятости одного листинга из шапки чата (без ухода со страницы).
 * На max-md — нижняя шторка ~90dvh; на sm+ — боковая панель.
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
  bookingId = null,
  bookingStatus = null,
  financialSnapshotInitial = null,
}) {
  const router = useRouter()
  const t = useCallback((key) => getUIText(key, language), [language])
  const isMobile = useMediaQuery('(max-width: 767px)')
  const [openInternal, setOpenInternal] = useState(false)
  const isControlled = openControlled !== undefined
  const open = isControlled ? openControlled : openInternal
  const setOpen = useCallback(
    (next) => {
      onOpenChangeControlled?.(next)
      if (!isControlled) setOpenInternal(next)
    },
    [isControlled, onOpenChangeControlled],
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [calendarPayload, setCalendarPayload] = useState(null)
  const scrollRef = useRef(null)
  const todayRef = useRef(null)

  const [financeOpen, setFinanceOpen] = useState(false)
  const [financeSnapshot, setFinanceSnapshot] = useState(null)
  const [financeLoading, setFinanceLoading] = useState(false)
  const [financeError, setFinanceError] = useState(null)

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

  const openFinanceModal = useCallback(async () => {
    if (!bookingId) return
    setFinanceError(null)
    setFinanceOpen(true)
    if (financialSnapshotInitial && typeof financialSnapshotInitial === 'object') {
      setFinanceSnapshot(financialSnapshotInitial)
      return
    }
    setFinanceLoading(true)
    setFinanceSnapshot(null)
    try {
      const res = await fetch(`/api/v2/partner/bookings/${encodeURIComponent(String(bookingId))}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json?.status === 'error') {
        throw new Error(json?.error || json?.message || 'HTTP')
      }
      const snap = json?.data?.financial_snapshot
      if (!snap) throw new Error('no_snapshot')
      setFinanceSnapshot(snap)
    } catch {
      setFinanceError(t('chatCalendarPeek_financeLoadError'))
      setFinanceSnapshot(null)
    } finally {
      setFinanceLoading(false)
    }
  }, [bookingId, financialSnapshotInitial, t])

  const dates = calendarPayload?.dates || []
  const listings = calendarPayload?.listings || []

  const peekDayWidth = 44
  const showFinanceBtn =
    mode === 'partner' && !!bookingId && hasUsableFinancialSnapshot(financialSnapshotInitial)

  return (
    <>
      {!hideTrigger && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={triggerClassName}
          title={t('chatCalendarPeek_triggerTitle')}
          onClick={() => onOpenChange(true)}
          disabled={!listingId}
        >
          <Calendar className="h-3.5 w-3.5 sm:mr-1" />
          <span className="hidden sm:inline">{t('chatCalendarPeek_triggerShort')}</span>
        </Button>
      )}

      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={isMobile ? 'bottom' : 'right'}
          overlayClassName="z-[340]"
          className={cn(
            'z-[350] flex flex-col gap-0 overflow-hidden bg-background',
            isMobile
              ? 'h-[90dvh] max-h-[90dvh] w-full rounded-t-2xl border-t border-slate-200 p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl'
              : 'w-full overflow-y-auto p-6 sm:max-w-3xl',
          )}
        >
          <SheetHeader
            className={cn(
              'shrink-0 space-y-1 text-left',
              isMobile ? 'px-4 pr-12' : 'pr-8',
            )}
          >
            <SheetTitle className={isMobile ? 'text-lg' : ''}>{t('chatCalendarPeek_sheetTitle')}</SheetTitle>
            <SheetDescription className="line-clamp-2">
              {listingTitle || t('chatCalendarPeek_sheetDescFallback')}
            </SheetDescription>
          </SheetHeader>

          <div
            className={cn(
              'flex min-h-0 flex-1 flex-col gap-4',
              isMobile ? 'mt-3 min-h-0 flex-1 overflow-hidden px-4' : 'mt-4',
            )}
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                {t('chatCalendarPeek_loading')}
              </div>
            ) : error ? (
              <p className="py-6 text-sm text-red-600">{error}</p>
            ) : listings.length === 0 ? (
              <p className="py-6 text-sm text-slate-600">{t('chatCalendarPeek_noData')}</p>
            ) : (
              <>
                <p className="text-sm font-medium leading-relaxed text-slate-600">
                  {mode === 'renter' ? t('chatCalendarPeek_hintRenter') : t('chatCalendarPeek_hintPartner')}
                </p>
                <div className={cn('min-h-0', isMobile && 'min-h-0 flex-1 overflow-y-auto overscroll-contain')}>
                  {isMobile ? (
                    <CalendarMobileAgenda
                      bare
                      dates={dates}
                      listings={listings}
                      onCellClick={handleCellClick}
                      language={language}
                    />
                  ) : (
                    <CalendarGrid
                      dates={dates}
                      listings={listings}
                      dayWidth={peekDayWidth}
                      viewMode="normal"
                      onCellClick={handleCellClick}
                      todayRef={todayRef}
                      scrollContainerRef={scrollRef}
                      scrollMaxHeight="min(58vh, 480px)"
                      language={language}
                    />
                  )}
                </div>
              </>
            )}

            {listingId && !loading && !error && listings.length > 0 ? (
              <div
                className={cn(
                  'shrink-0 space-y-2 border-t border-slate-200 pt-4',
                  isMobile && 'mt-auto pb-1',
                )}
              >
                <p className="text-xs font-medium leading-snug text-slate-600">
                  {mode === 'renter' ? t('chatCalendarPeek_footerRenter') : t('chatCalendarPeek_footerPartner')}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  {showFinanceBtn ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 w-full gap-2 border-teal-200 text-teal-900 hover:bg-teal-50 sm:h-10 sm:w-auto sm:text-sm"
                      onClick={() => void openFinanceModal()}
                    >
                      <Receipt className="h-4 w-4 shrink-0" aria-hidden />
                      {t('chatCalendarPeek_financeBooking')}
                    </Button>
                  ) : null}
                  {mode === 'partner' ? (
                    <Button asChild className="h-11 w-full bg-teal-600 text-base hover:bg-teal-700 sm:h-10 sm:w-auto sm:text-sm">
                      <Link href={`/partner/calendar?listingId=${encodeURIComponent(listingId)}&from=chat`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t('chatCalendarPeek_openFullCalendar')}
                      </Link>
                    </Button>
                  ) : (
                    <Button asChild variant="outline" className="h-11 w-full text-base sm:h-10 sm:w-auto sm:text-sm">
                      <Link href={listingId ? `/listings/${listingId}` : '#'}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        {t('chatCalendarPeek_listingPage')}
                      </Link>
                    </Button>
                  )}
                </div>
                {financeLoading ? (
                  <p className="flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t('chatCalendarPeek_loading')}
                  </p>
                ) : null}
                {financeError ? <p className="text-xs text-red-600">{financeError}</p> : null}
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <PartnerFinancialSnapshotDialog
        open={financeOpen}
        onOpenChange={(v) => {
          setFinanceOpen(v)
          if (!v) {
            setFinanceSnapshot(null)
            setFinanceError(null)
          }
        }}
        snapshot={financeSnapshot}
        bookingTitle={listingTitle || '—'}
        bookingId={bookingId}
        status={bookingStatus}
        language={language}
      />
    </>
  )
}
