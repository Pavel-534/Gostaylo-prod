'use client'

import * as React from "react"
import { format, parseISO, startOfDay, addDays, isSameDay, isBefore, differenceInDays } from "date-fns"
import { ru, enUS, zhCN, th } from "date-fns/locale"
import { CalendarIcon, X, Loader2, ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer"

const locales = { ru, en: enUS, zh: zhCN, th }

// Context for blocked nights data
const BlockedNightsContext = React.createContext({ blockedNightsSet: new Set() })

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(null)
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

/**
 * Clean Day Button - Hard Blocking via CSS
 * Blocked nights: opacity-30, pointer-events: none
 * No dots, no rings, no gradients - just clean professional blocking
 */
function CleanDayButton({ className, day, modifiers, ...props }) {
  const { blockedNightsSet } = React.useContext(BlockedNightsContext)
  const defaultClassNames = getDefaultClassNames()
  const ref = React.useRef(null)

  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  const dateStr = format(day.date, 'yyyy-MM-dd')
  const isBlockedNight = blockedNightsSet.has(dateStr)
  const isPast = isBefore(startOfDay(day.date), startOfDay(new Date()))
  const isToday = isSameDay(day.date, new Date())
  
  // Hard blocking: blocked night OR past date
  const isDisabled = isBlockedNight || isPast

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={dateStr}
      data-blocked={isBlockedNight}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        // Base
        "relative flex aspect-square h-auto w-full min-w-[--cell-size] items-center justify-center text-sm transition-colors",
        // Today - just bold, no ring
        isToday && !modifiers.range_start && !modifiers.range_end && "font-bold",
        // Range selection - teal solid colors
        "data-[range-start=true]:bg-teal-600 data-[range-start=true]:text-white data-[range-start=true]:rounded-l-md data-[range-start=true]:rounded-r-none",
        "data-[range-end=true]:bg-teal-600 data-[range-end=true]:text-white data-[range-end=true]:rounded-r-md data-[range-end=true]:rounded-l-none",
        "data-[range-middle=true]:bg-teal-50 data-[range-middle=true]:text-teal-900 data-[range-middle=true]:rounded-none",
        // HARD BLOCKING - opacity-30 + no clicks
        isDisabled && "opacity-30 pointer-events-none cursor-not-allowed text-slate-400",
        // Available days hover
        !isDisabled && "hover:bg-slate-100",
        defaultClassNames.day,
        className
      )}
      disabled={isDisabled}
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      {...props}
    >
      {day.date.getDate()}
    </Button>
  )
}

// Static Chevron
function ChevronComponent({ orientation, ...props }) {
  return orientation === "left" 
    ? <ChevronLeftIcon className="size-4" {...props} />
    : <ChevronRightIcon className="size-4" {...props} />
}

// Loading skeleton
function CalendarSkeleton() {
  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-8 w-8 mx-auto" />)}
      </div>
      {[...Array(5)].map((_, row) => (
        <div key={row} className="grid grid-cols-7 gap-1">
          {[...Array(7)].map((_, col) => <Skeleton key={col} className="h-9 w-9 rounded-md mx-auto" />)}
        </div>
      ))}
    </div>
  )
}

/**
 * Interval-Based Date Range Picker (Airbnb/Booking.com style)
 * 
 * CORE LOGIC:
 * - We book NIGHTS, not days
 * - blockedNights = dates where you cannot START a stay
 * - Check-out day of Guest A = available Check-in for Guest B
 * - A date is disabled ONLY if its NIGHT is blocked
 */
export function BookingDateRangePicker({
  value = { from: null, to: null },
  onChange,
  blockedDates = [],
  isLoading = false,
  language = "ru",
  className,
  disabled = false,
  numberOfMonths = 1,
  "data-testid": dataTestId
}) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobile()
  const locale = locales[language] || locales.ru

  // O(1) lookup for blocked nights
  const blockedNightsSet = React.useMemo(() => new Set(blockedDates), [blockedDates])

  // Disabled check: only if the NIGHT starting on this date is blocked
  const isDateDisabled = React.useCallback((date) => {
    const d = startOfDay(date)
    const today = startOfDay(new Date())
    if (isBefore(d, today)) return true
    return blockedNightsSet.has(format(d, 'yyyy-MM-dd'))
  }, [blockedNightsSet])

  // Handle range selection with validation
  const handleSelect = React.useCallback((range) => {
    if (!range) {
      onChange({ from: null, to: null })
      return
    }

    // Validate check-in date
    if (range.from && isDateDisabled(range.from)) return

    // Validate range - check all nights between check-in and check-out
    if (range.from && range.to && !isSameDay(range.from, range.to)) {
      let current = startOfDay(range.from)
      const end = startOfDay(range.to)
      while (current < end) {
        if (blockedNightsSet.has(format(current, 'yyyy-MM-dd'))) {
          onChange({ from: range.from, to: null })
          return
        }
        current = addDays(current, 1)
      }
    }

    onChange(range)

    // Close after complete selection
    if (range.from && range.to && !isSameDay(range.from, range.to)) {
      setTimeout(() => setOpen(false), 150)
    }
  }, [onChange, isDateDisabled, blockedNightsSet])

  // Display text
  const displayText = React.useMemo(() => {
    if (isLoading) return language === 'ru' ? 'Загрузка...' : 'Loading...'
    if (!value?.from) return language === 'ru' ? 'Заезд — Выезд' : 'Check-in — Check-out'
    if (!value.to || isSameDay(value.from, value.to)) {
      return `${format(value.from, 'd MMM', { locale })} — ...`
    }
    const nights = differenceInDays(value.to, value.from)
    const nightsText = language === 'ru'
      ? `${nights} ${nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}`
      : `${nights} night${nights > 1 ? 's' : ''}`
    return `${format(value.from, 'd MMM', { locale })} — ${format(value.to, 'd MMM', { locale })} (${nightsText})`
  }, [value, locale, language, isLoading])

  const defaultClassNames = getDefaultClassNames()

  // Trigger button
  const TriggerButton = (
    <Button
      variant="outline"
      disabled={disabled || isLoading}
      data-testid={dataTestId}
      className={cn(
        "w-full h-12 justify-start text-left font-normal",
        !value?.from && "text-muted-foreground",
        isLoading && "animate-pulse",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin text-slate-400" />
      ) : (
        <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
      )}
      <span className="truncate">{displayText}</span>
    </Button>
  )

  // Calendar with clean styles
  const CalendarContent = isLoading ? (
    <CalendarSkeleton />
  ) : (
    <BlockedNightsContext.Provider value={{ blockedNightsSet }}>
      <DayPicker
        mode="range"
        selected={value}
        onSelect={handleSelect}
        locale={locale}
        disabled={isDateDisabled}
        numberOfMonths={numberOfMonths}
        showOutsideDays={false}
        className={cn(
          "bg-background p-3 [--cell-size:2.5rem]",
          isMobile && "[--cell-size:2.8rem]"
        )}
        classNames={{
          root: cn("w-fit", defaultClassNames.root),
          months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
          month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
          nav: cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", defaultClassNames.nav),
          button_previous: cn(buttonVariants({ variant: "ghost" }), "h-[--cell-size] w-[--cell-size] p-0", defaultClassNames.button_previous),
          button_next: cn(buttonVariants({ variant: "ghost" }), "h-[--cell-size] w-[--cell-size] p-0", defaultClassNames.button_next),
          month_caption: cn("flex h-[--cell-size] w-full items-center justify-center px-[--cell-size]", defaultClassNames.month_caption),
          caption_label: cn("select-none font-medium text-sm", defaultClassNames.caption_label),
          table: "w-full border-collapse",
          weekdays: cn("flex", defaultClassNames.weekdays),
          weekday: cn("text-muted-foreground flex-1 select-none text-[0.8rem] font-normal", defaultClassNames.weekday),
          week: cn("mt-2 flex w-full", defaultClassNames.week),
          day: cn("group/day relative aspect-square h-full w-full select-none p-0 text-center", defaultClassNames.day),
          // Clean range styles - solid teal
          range_start: cn("bg-teal-600 text-white rounded-l-md rounded-r-none", defaultClassNames.range_start),
          range_middle: cn("bg-teal-50 rounded-none", defaultClassNames.range_middle),
          range_end: cn("bg-teal-600 text-white rounded-r-md rounded-l-none", defaultClassNames.range_end),
          // Today - no ring, handled in DayButton
          today: cn("", defaultClassNames.today),
          outside: cn("text-muted-foreground opacity-30", defaultClassNames.outside),
          // Disabled handled by DayButton
          disabled: cn("", defaultClassNames.disabled),
          hidden: cn("invisible", defaultClassNames.hidden),
        }}
        components={{
          Chevron: ChevronComponent,
          DayButton: CleanDayButton,
        }}
      />
    </BlockedNightsContext.Provider>
  )

  // Selection hint
  const SelectionHint = value?.from && (!value?.to || isSameDay(value.from, value.to)) && !isLoading ? (
    <div className="mb-3 text-center text-sm text-teal-600 bg-teal-50 rounded-lg py-2 px-3">
      {language === 'ru' ? '✓ Заезд выбран. Выберите дату выезда' : '✓ Check-in selected. Select check-out date'}
    </div>
  ) : null

  // Range display (mobile)
  const RangeDisplay = value?.from && value?.to && !isSameDay(value.from, value.to) ? (
    <div className="mt-4 text-center">
      <div className="inline-flex items-center gap-2 bg-slate-100 rounded-lg px-4 py-2">
        <span className="text-sm font-medium">
          {format(value.from, 'd MMMM', { locale })} — {format(value.to, 'd MMMM', { locale })}
        </span>
        <span className="text-xs text-slate-500">
          ({differenceInDays(value.to, value.from)} {language === 'ru' ? 'ночей' : 'nights'})
        </span>
      </div>
    </div>
  ) : null

  // Mobile: Drawer
  if (isMobile === true) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <div onClick={() => !disabled && !isLoading && setOpen(true)}>
          {TriggerButton}
        </div>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="relative border-b pb-4">
            <DrawerTitle className="text-center">
              {language === 'ru' ? 'Выберите даты' : 'Select dates'}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="absolute right-2 top-2">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="flex-1 overflow-auto p-4">
            {SelectionHint}
            <div className="flex justify-center">{CalendarContent}</div>
            {RangeDisplay}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // Desktop: Popover
  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>{TriggerButton}</PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start" sideOffset={4} onInteractOutside={(e) => e.preventDefault()}>
        {SelectionHint}
        {CalendarContent}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Check if a date range has any blocked NIGHTS
 * For stay check_in to check_out, checks nights from check_in to check_out - 1
 */
export function hasBlockedNightInRange(checkIn, checkOut, blockedNights) {
  if (!checkIn || !checkOut || !blockedNights.length) return false
  const start = startOfDay(typeof checkIn === 'string' ? parseISO(checkIn) : checkIn)
  const end = startOfDay(typeof checkOut === 'string' ? parseISO(checkOut) : checkOut)
  const blockedSet = new Set(blockedNights)
  let current = start
  while (current < end) {
    if (blockedSet.has(format(current, 'yyyy-MM-dd'))) return true
    current = addDays(current, 1)
  }
  return false
}

// Backwards compatibility
export const hasBlockedDateInRange = hasBlockedNightInRange

export default BookingDateRangePicker
