'use client'

import * as React from "react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameDay, isSameMonth, isBefore, differenceInDays } from "date-fns"
import { ru, enUS, th, zhCN } from "date-fns/locale"
import { ChevronLeft, ChevronRight, Loader2, CalendarIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { getUIText } from "@/lib/translations"
import { formatRentalSpanLabel } from "@/lib/rental-period-labels"
import { toListingDate } from "@/lib/listing-date"
import { formatDisplayDate } from "@/lib/date-display-format"
import { useListingPublicCalendarQuery } from '@/hooks/use-listing-public-calendar-query'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

const locales = { ru, en: enUS, th, zh: zhCN }

/**
 * 
 * Features:
 * - Fetches data once from /api/v2/listings/[id]/calendar
 * - Mobile: Vertical scroll months
 * - Desktop: 2 months side-by-side
 * - Split-day visual for transition days
 * - Real-time pricing calculation
 * - Smart selection validation
 */

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

/**
 * Single Day Cell Component
 */
function DayCell({ 
  date, 
  dayData, 
  isSelected, 
  isRangeStart, 
  isRangeEnd, 
  isInRange,
  isSelectingCheckout,
  onSelect,
  locale
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const isToday = isSameDay(date, today)
  const isPast = isBefore(date, today)
  
  // Get status from API data
  const status = dayData?.status || 'UNKNOWN'
  const canCheckIn = dayData?.can_check_in ?? false
  const canCheckOut = dayData?.can_check_out ?? false
  const isTransition = dayData?.is_transition ?? false
  const price = dayData?.price || 0
  
  // Determine if clickable
  let isClickable = false
  let visuallyBlocked = false
  
  if (!isPast && status !== 'PAST') {
    if (isSelectingCheckout) {
      isClickable = true
      visuallyBlocked = false
    } else {
      // Today is always a valid check-in anchor unless explicitly blocked for the whole day
      const todayCheckInOk = isToday && status !== 'BLOCKED'
      isClickable = canCheckIn || todayCheckInOk || (isTransition && canCheckOut)
      visuallyBlocked = status === 'BLOCKED' && !isTransition && !todayCheckInOk
    }
  } else {
    visuallyBlocked = true
  }
  
  const handleClick = () => {
    if (isClickable) {
      onSelect(date, dayData)
    }
  }
  
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isClickable}
      className={cn(
        "relative aspect-square w-full flex flex-col items-center justify-center text-sm transition-all",
        "focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-1 rounded-lg",
        isToday && !isRangeStart && !isRangeEnd && "font-bold ring-2 ring-brand/50 ring-inset",
        isRangeStart && "bg-brand text-white shadow-md ring-2 ring-brand ring-offset-1 ring-offset-white dark:ring-offset-slate-900 rounded-l-lg rounded-r-none z-10",
        isRangeEnd && "bg-brand text-white shadow-md ring-2 ring-brand ring-offset-1 ring-offset-white dark:ring-offset-slate-900 rounded-r-lg rounded-l-none z-10",
        isRangeStart && isRangeEnd && "rounded-lg",
        isInRange && !isRangeStart && !isRangeEnd && "bg-brand/25 text-brand-hover dark:bg-brand/35 dark:text-brand rounded-none",
        visuallyBlocked && "opacity-20 pointer-events-none cursor-not-allowed text-slate-400",
        isClickable && !isSelected && !visuallyBlocked && "hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer",
        isTransition && !isSelected && !isInRange && !isSelectingCheckout && "transition-day-split"
      )}
      data-date={toListingDate(date) || format(date, 'yyyy-MM-dd')}
      data-status={status}
      data-transition={isTransition}
      data-clickable={isClickable}
    >
      <span className={cn(
        "relative z-10",
        isRangeStart || isRangeEnd ? "font-semibold" : ""
      )}>
        {date.getDate()}
      </span>
      
      {/* Price indicator - compact, below date number */}
      {isClickable && !visuallyBlocked && price > 0 && !isSelected && !isInRange && (
        <span className="hidden md:block text-[9px] text-slate-500 leading-tight mt-0.5 block">
          ฿{(price / 1000).toFixed(0)}k
        </span>
      )}
    </button>
  )
}

/**
 * Month Grid Component
 */
function MonthGrid({ 
  month, 
  calendarData, 
  selectedRange, 
  isSelectingCheckout,
  onDaySelect,
  locale 
}) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }) // Monday start
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
  
  // Build weeks - pad to 6 rows to prevent calendar "jumping" when month has 5 vs 6 weeks
  const weeks = []
  let days = []
  let day = startDate
  
  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      days.push(new Date(day))
      day = addDays(day, 1)
    }
    weeks.push(days)
    days = []
  }
  // Pad to 6 rows with placeholder nulls (rendered as empty cells)
  while (weeks.length < 6) {
    weeks.push(Array(7).fill(null))
  }
  
  // Weekday headers (Monday first)
  const weekDays = locale === 'ru' 
    ? ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    : locale === 'zh' ? ['一', '二', '三', '四', '五', '六', '日']
    : locale === 'th' ? ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.', 'อา.']
    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  
  return (
    <div className="w-full">
      {/* Month header */}
      <div className="text-center font-semibold text-slate-900 mb-3 capitalize">
        {format(month, 'LLLL yyyy', { locale: locales[locale] || locales.ru })}
      </div>
      
      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map((d, i) => (
          <div key={i} className="text-center text-sm text-slate-500 font-medium py-1">
            {d}
          </div>
        ))}
      </div>
      
      {/* Days grid - fixed 6 rows + fixed height to prevent layout jump when month has 5 vs 6 weeks */}
      <div className="grid grid-cols-7 grid-rows-6 gap-2 h-[200px] [&>*]:min-h-0">
        {weeks.flat().map((date, idx) => {
          if (!date) return <div key={idx} className="aspect-square min-w-0 min-h-0" />
          const dateStr = toListingDate(date) || format(date, 'yyyy-MM-dd')
          const dayData = calendarData.get(dateStr)
          const isCurrentMonth = isSameMonth(date, month)
          
          if (!isCurrentMonth) {
            return <div key={idx} className="aspect-square min-w-0 min-h-0" />
          }
          
          // Check selection state
          const isRangeStart = selectedRange.from && isSameDay(date, selectedRange.from)
          const isRangeEnd = selectedRange.to && isSameDay(date, selectedRange.to)
          const isInRange = selectedRange.from && selectedRange.to && 
            date > selectedRange.from && date < selectedRange.to
          const isSelected = isRangeStart || isRangeEnd
          
          return (
            <DayCell
              key={idx}
              date={date}
              dayData={dayData}
              isSelected={isSelected}
              isRangeStart={isRangeStart}
              isRangeEnd={isRangeEnd}
              isInRange={isInRange}
              isSelectingCheckout={isSelectingCheckout}
              onSelect={onDaySelect}
              locale={locale}
            />
          )
        })}
      </div>
    </div>
  )
}

/**
 * Main Calendar Component
 */
export function PlatformCalendar({
  listingId,
  value = { from: null, to: null },
  onChange,
  language = "ru",
  className,
  onPriceCalculated,
  guests = 1,
  /**
   * max_capacity из API листинга. Если null или ≤1, сервер в CalendarService всегда использует g=1 —
   * сетка дат не зависит от гостей → не дергаем /calendar при каждом +/- .
   */
  listingMaxCapacity = null,
  /** Задержка перед повторным запросом календаря при смене гостей (shared inventory). */
  guestsRefetchDebounceMs = 420,
  /** 'night' — жильё; 'day' — транспорт (сутки) */
  rentalPeriodMode = "night",
}) {
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (value?.from) {
      return startOfMonth(value.from)
    }
    return new Date()
  })
  const [open, setOpen] = React.useState(false)
  
  const isMobile = useIsMobile()
  const locale = language
  
  // Is selecting checkout? (check-in already selected)
  const isSelectingCheckout = value?.from && !value?.to
  
  const guestsCount = Math.max(1, parseInt(guests, 10) || 1)
  const partyAffectsCalendarGrid =
    listingMaxCapacity != null && Number(listingMaxCapacity) > 1

  const [debouncedPartyGuests, setDebouncedPartyGuests] = React.useState(guestsCount)
  React.useEffect(() => {
    if (!partyAffectsCalendarGrid) {
      setDebouncedPartyGuests(1)
      return
    }
    const t = setTimeout(() => setDebouncedPartyGuests(guestsCount), guestsRefetchDebounceMs)
    return () => clearTimeout(t)
  }, [guestsCount, partyAffectsCalendarGrid, guestsRefetchDebounceMs])

  const guestsQueryParam = partyAffectsCalendarGrid ? debouncedPartyGuests : 1

  const {
    calendarData,
    isLoading: loading,
    isRefreshing: backgroundRefreshing,
    error: calendarQueryError,
  } = useListingPublicCalendarQuery(listingId, {
    guests: guestsQueryParam,
    enabled: !!listingId,
  })

  const error = calendarQueryError?.message || null
  
  // Calculate price when selection changes
  React.useEffect(() => {
    if (!value?.from || !value?.to || calendarData.size === 0) {
      onPriceCalculated?.(null)
      return
    }
    
    let totalPrice = 0
    let nights = 0
    let current = new Date(value.from)
    const end = new Date(value.to)
    
    // Sum prices for each night (check-in to check-out - 1)
    while (current < end) {
      const dateStr = toListingDate(current) || format(current, 'yyyy-MM-dd')
      const dayData = calendarData.get(dateStr)
      if (dayData) {
        totalPrice += dayData.price || 0
        nights++
      }
      current = addDays(current, 1)
    }
    
    onPriceCalculated?.({ nights, totalPrice })
  }, [value?.from?.getTime(), value?.to?.getTime(), calendarData.size])
  
  // Handle day selection
  const handleDaySelect = React.useCallback((date, dayData) => {
    if (!value?.from) {
      // First click - set check-in
      onChange({ from: date, to: null })
      return
    }
    
    if (isSelectingCheckout) {
      // Second click - validate and set check-out
      if (isBefore(date, value.from) || isSameDay(date, value.from)) {
        // Clicked before or same as check-in - reset
        onChange({ from: date, to: null })
        return
      }
      
      // Validate: check all nights between check-in and check-out
      let current = new Date(value.from)
      while (current < date) {
        const dateStr = toListingDate(current) || format(current, 'yyyy-MM-dd')
        const dayInfo = calendarData.get(dateStr)
        
        // If any night is blocked (and not transition), reset
        if (dayInfo && dayInfo.status === 'BLOCKED' && !dayInfo.is_transition && !dayInfo.can_check_in) {
          // Blocked night in range - reset to this date as new check-in
          if (dayData?.can_check_in) {
            onChange({ from: date, to: null })
          }
          return
        }
        current = addDays(current, 1)
      }
      
      // Valid range - set check-out
      onChange({ from: value.from, to: date })
      
      // Auto-close calendar after selection (both mobile and desktop)
      setTimeout(() => setOpen(false), 200)
    } else {
      // Already have both dates - start new selection
      onChange({ from: date, to: null })
    }
  }, [value, onChange, calendarData, isSelectingCheckout, isMobile])
  
  // Generate months to display
  const months = React.useMemo(() => {
    const result = []
    const monthCount = isMobile ? 6 : 2 // Mobile: 6 months scroll, Desktop: 2 months
    
    for (let i = 0; i < monthCount; i++) {
      result.push(addMonths(currentMonth, i))
    }
    return result
  }, [currentMonth, isMobile])
  
  // Navigation
  const goToPrevMonth = () => setCurrentMonth(prev => addMonths(prev, -1))
  const goToNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1))
  
  // Display text
  const displayText = React.useMemo(() => {
    if (loading && calendarData.size === 0) return getUIText('loading', language)
    if (!value?.from) return `${getUIText('checkIn', language)} — ${getUIText('checkOut', language)}`
    if (!value.to) {
      return `${formatDisplayDate(value.from)} — …`
    }
    
    const nights = differenceInDays(value.to, value.from)
    const spanMode = rentalPeriodMode === "day" ? "day" : "night"
    const nightsText = formatRentalSpanLabel(nights, spanMode, language)

    return `${formatDisplayDate(value.from)} — ${formatDisplayDate(value.to)} (${nightsText})`
  }, [value, locale, language, loading, rentalPeriodMode, calendarData.size])
  
  // Trigger button
  const showBlockingChrome = loading && calendarData.size === 0

  const TriggerButton = (
    <Button
      variant="outline"
      disabled={showBlockingChrome}
      data-testid="platform-calendar-trigger"
      className={cn(
        "w-full h-12 justify-start text-left font-normal",
        !value?.from && "text-muted-foreground",
        showBlockingChrome && "animate-pulse",
        className
      )}
      onClick={() => setOpen(true)}
    >
      {showBlockingChrome ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-400" />
      ) : (
        <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
      )}
      <span className="truncate">{displayText}</span>
    </Button>
  )
  
  // Selection hint
  const SelectionHint = isSelectingCheckout ? (
    <div className="mb-4 text-center text-sm text-brand bg-brand/10 rounded-lg py-2 px-3">
      {getUIText('checkInSelectedHint', language)}
    </div>
  ) : null
  
  // Calendar content
  const CalendarContent = showBlockingChrome ? (
    <div className="p-4 space-y-4">
      <Skeleton className="h-8 w-40 mx-auto" />
      <div className="grid grid-cols-7 gap-2">
        {[...Array(35)].map((_, i) => <Skeleton key={i} className="aspect-square rounded-lg" />)}
      </div>
    </div>
  ) : error ? (
    <div className="p-8 text-center text-red-500">
      {error}
    </div>
  ) : (
    <div className="relative p-4">
      {backgroundRefreshing && (
        <div
          className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-md bg-white/85 px-2 py-1 text-[11px] font-medium text-slate-400 shadow-sm ring-1 ring-slate-200/80 backdrop-blur-[2px]"
          aria-live="polite"
          data-testid="platform-calendar-refreshing"
        >
          <Loader2 className="h-3 w-3 shrink-0 animate-spin text-slate-400" aria-hidden />
          <span>{getUIText('calendarRefreshing', language)}</span>
        </div>
      )}
      {SelectionHint}
      
      {/* Desktop: 2 months side-by-side (arrows in header) */}
      {!isMobile && (
        <div className="flex items-start justify-center gap-8">
          {months.slice(0, 2).map((month, idx) => (
            <MonthGrid
              key={idx}
              month={month}
              calendarData={calendarData}
              selectedRange={value}
              isSelectingCheckout={isSelectingCheckout}
              onDaySelect={handleDaySelect}
              locale={locale}
            />
          ))}
        </div>
      )}
      
      {/* Mobile: Vertical scroll months */}
      {isMobile && (
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pb-4">
          {months.map((month, idx) => (
            <MonthGrid
              key={idx}
              month={month}
              calendarData={calendarData}
              selectedRange={value}
              isSelectingCheckout={isSelectingCheckout}
              onDaySelect={handleDaySelect}
              locale={locale}
            />
          ))}
        </div>
      )}
    </div>
  )
  
  // Mobile: Use Drawer
  if (isMobile === true) {
    return (
      <>
        {TriggerButton}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="max-h-[90vh]" data-testid="platform-calendar-picker">
            <DrawerHeader className="relative border-b pb-4">
              <DrawerTitle className="text-center">
                {getUIText('datePickerTitle', language)}
              </DrawerTitle>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="absolute right-2 top-2">
                  <X className="h-4 w-4" />
                </Button>
              </DrawerClose>
            </DrawerHeader>
            {CalendarContent}
          </DrawerContent>
        </Drawer>
      </>
    )
  }
  
  // Desktop: Use centered modal (~50% screen, no overlap with header)
  if (isMobile === false) {
    return (
      <>
        {TriggerButton}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent
            data-testid="platform-calendar-picker"
            className="!max-w-[min(700px,90vw)] w-[min(700px,90vw)] max-h-[50vh] min-h-[400px] overflow-hidden p-0 gap-0 [&>button]:hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <DialogTitle className="text-lg font-semibold m-0">
                {getUIText('datePickerTitle', language)}
              </DialogTitle>
              <div className="flex items-center gap-3">
                <Button variant="outline" size="icon" onClick={goToPrevMonth} className="h-9 w-9 shrink-0">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button variant="outline" size="icon" onClick={goToNextMonth} className="h-9 w-9 shrink-0">
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} className="h-9 w-9 shrink-0 ml-2">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6">
              {CalendarContent}
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }
  
  return TriggerButton
}

// CSS for transition day split visual
const transitionDayStyles = `
.transition-day-split {
  background: linear-gradient(
    135deg,
    rgba(148, 163, 184, 0.3) 0%,
    rgba(148, 163, 184, 0.3) 48%,
    rgba(255, 255, 255, 1) 52%,
    rgba(255, 255, 255, 1) 100%
  );
  border: 1px solid rgba(20, 184, 166, 0.3);
}
.transition-day-split:hover {
  background: linear-gradient(
    135deg,
    rgba(148, 163, 184, 0.4) 0%,
    rgba(148, 163, 184, 0.4) 48%,
    rgba(240, 253, 250, 1) 52%,
    rgba(240, 253, 250, 1) 100%
  );
}
`

// Inject styles
if (typeof document !== 'undefined') {
  const styleId = 'platform-calendar-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = transitionDayStyles
    document.head.appendChild(style)
  }
}

export default PlatformCalendar
