'use client'

import * as React from "react"
import { format, parseISO, startOfDay, addDays, subDays, isSameDay, isBefore, differenceInDays } from "date-fns"
import { ru, enUS, zhCN, th } from "date-fns/locale"
import { CalendarIcon, X, Loader2 } from "lucide-react"
import { DayPicker, getDefaultClassNames } from "react-day-picker"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"

const locales = { ru, en: enUS, zh: zhCN, th }

// Context for passing blocked nights data to DayButton
const BlockedNightsContext = React.createContext({
  blockedNightsSet: new Set(),
  checkoutDaysSet: new Set()
})

// Static Chevron component (no re-render issues)
function ChevronComponent({ orientation, ...props }) {
  if (orientation === "left") {
    return <ChevronLeftIcon className="size-4" {...props} />
  }
  return <ChevronRightIcon className="size-4" {...props} />
}

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
 * Custom Day Component with Split Visual for Check-out Days
 * Shows diagonal split when a date is both check-out (previous booking ends) 
 * and available for new check-in
 */
function NightBasedDayContent({ date, displayMonth, blockedNightsSet, checkoutDaysSet }) {
  const dateStr = format(date, 'yyyy-MM-dd')
  const isBlocked = blockedNightsSet.has(dateStr)
  const isCheckoutDay = checkoutDaysSet.has(dateStr)
  
  // Check-out day: previous guest leaves, new guest can check in
  // Show split visual only if it's a checkout day AND not blocked
  const showSplitVisual = isCheckoutDay && !isBlocked
  
  if (showSplitVisual) {
    return (
      <div className="relative w-full h-full flex items-center justify-center">
        {/* Diagonal split background - more visible */}
        <div 
          className="absolute inset-0 overflow-hidden rounded-md"
          style={{
            background: `linear-gradient(135deg, 
              rgba(239, 68, 68, 0.25) 0%, 
              rgba(239, 68, 68, 0.25) 48%, 
              rgba(20, 184, 166, 0.15) 52%, 
              rgba(20, 184, 166, 0.15) 100%)`
          }}
        />
        {/* Small teal dot indicator - "available for check-in" */}
        <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-teal-500 rounded-full shadow-sm" />
        <span className="relative z-10 text-sm font-medium">{date.getDate()}</span>
      </div>
    )
  }
  
  return (
    <span className="text-sm font-medium">{date.getDate()}</span>
  )
}

/**
 * Custom Day Button with Hard Blocking
 * Applies pointer-events: none and opacity for blocked nights
 * Uses context to get blocked nights data (avoids re-render issues)
 */
function BlockingDayButton({ className, day, modifiers, ...props }) {
  const { blockedNightsSet, checkoutDaysSet } = React.useContext(BlockedNightsContext)
  const defaultClassNames = getDefaultClassNames()
  const ref = React.useRef(null)
  
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])
  
  const dateStr = format(day.date, 'yyyy-MM-dd')
  const isBlockedNight = blockedNightsSet.has(dateStr)
  const isCheckoutDay = checkoutDaysSet.has(dateStr)
  const isPast = isBefore(startOfDay(day.date), startOfDay(new Date()))
  
  // Hard blocking: completely disabled (no clicks possible)
  const isHardBlocked = isBlockedNight || isPast
  
  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString()}
      data-blocked={isBlockedNight}
      data-checkout-day={isCheckoutDay && !isBlockedNight}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        // Base styles
        "relative flex aspect-square h-auto w-full min-w-[--cell-size] flex-col items-center justify-center gap-1 font-normal leading-none transition-all duration-150",
        // Selection styles - Teal color for range
        "data-[selected-single=true]:bg-teal-600 data-[selected-single=true]:text-white",
        "data-[range-middle=true]:bg-teal-100 data-[range-middle=true]:text-teal-900",
        "data-[range-start=true]:bg-teal-600 data-[range-start=true]:text-white data-[range-start=true]:rounded-l-md",
        "data-[range-end=true]:bg-teal-600 data-[range-end=true]:text-white data-[range-end=true]:rounded-r-md",
        "data-[range-middle=true]:rounded-none",
        // Focus styles
        "group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-ring/50",
        "group-data-[focused=true]/day:relative group-data-[focused=true]/day:z-10 group-data-[focused=true]/day:ring-[3px]",
        // Checkout day special style (split visual hint via border)
        "data-[checkout-day=true]:ring-1 data-[checkout-day=true]:ring-teal-300 data-[checkout-day=true]:ring-inset",
        // HARD BLOCKING - Absolutely no interaction
        isHardBlocked && "opacity-40 pointer-events-none cursor-not-allowed line-through text-slate-400",
        // Default hover for available days
        !isHardBlocked && "hover:bg-teal-50 hover:text-teal-700",
        defaultClassNames.day,
        className
      )}
      disabled={isHardBlocked}
      tabIndex={isHardBlocked ? -1 : 0}
      aria-disabled={isHardBlocked}
      {...props}
    >
      <NightBasedDayContent 
        date={day.date} 
        blockedNightsSet={blockedNightsSet}
        checkoutDaysSet={checkoutDaysSet}
      />
    </Button>
  )
}

/**
 * Calendar Loading Skeleton
 */
function CalendarSkeleton() {
  return (
    <div className="p-3 space-y-4">
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 mx-auto" />
        ))}
      </div>
      {[...Array(5)].map((_, row) => (
        <div key={row} className="grid grid-cols-7 gap-1">
          {[...Array(7)].map((_, col) => (
            <Skeleton key={col} className="h-9 w-9 rounded-md mx-auto" />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Night-Based Date Range Picker (Booking.com style)
 * 
 * CORE CONCEPT:
 * - We book NIGHTS, not days
 * - blockedNights array contains dates where you cannot START a stay
 * - A check-out day is CLICKABLE as the next guest's check-in day
 * - Calendar VISUALLY disables blocked nights with opacity + pointer-events: none
 * - Split visual indicator shows check-out days (guest leaves, new check-in available)
 */
export function BookingDateRangePicker({
  value = { from: null, to: null },
  onChange,
  blockedDates = [], // Array of blocked NIGHTS (dates where you cannot start a stay)
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
  
  // Set of blocked nights for O(1) lookup
  const blockedNightsSet = React.useMemo(() => {
    return new Set(blockedDates)
  }, [blockedDates])
  
  // Set of check-out days (day AFTER a blocked night = check-out day)
  // These are special: previous guest leaves, available for new check-in
  const checkoutDaysSet = React.useMemo(() => {
    const checkoutDays = new Set()
    blockedDates.forEach(dateStr => {
      const date = parseISO(dateStr)
      const nextDay = addDays(date, 1)
      const nextDayStr = format(nextDay, 'yyyy-MM-dd')
      // Only mark as checkout day if the NEXT day is NOT blocked
      if (!blockedNightsSet.has(nextDayStr)) {
        checkoutDays.add(nextDayStr)
      }
    })
    return checkoutDays
  }, [blockedDates, blockedNightsSet])
  
  /**
   * Night-based disabled check:
   * A date is disabled if:
   * 1. It's in the past (before today)
   * 2. The NIGHT starting on this date is blocked (date is in blockedNights)
   * 
   * Check-out days are NOT in blockedNights, so they remain clickable
   */
  const isDateDisabled = React.useCallback((date) => {
    const d = startOfDay(date)
    const today = startOfDay(new Date())
    
    // Past dates always disabled
    if (isBefore(d, today)) return true
    
    // Check if this NIGHT is blocked
    const dateStr = format(d, 'yyyy-MM-dd')
    return blockedNightsSet.has(dateStr)
  }, [blockedNightsSet])
  
  /**
   * Handle range selection
   * For night-based logic:
   * - User clicks check-in date (must not be blocked)
   * - User clicks check-out date (the night OF check-out is NOT booked)
   * - We check all NIGHTS between check-in and check-out - 1
   */
  const handleSelect = React.useCallback((range) => {
    if (!range) {
      onChange({ from: null, to: null })
      return
    }
    
    // Check-in date must not be a blocked night
    if (range.from && isDateDisabled(range.from)) {
      return
    }
    
    // If both dates selected and different, validate the range
    if (range.from && range.to && !isSameDay(range.from, range.to)) {
      // Check all NIGHTS in the stay (check_in to check_out - 1)
      let current = startOfDay(range.from)
      const end = startOfDay(range.to)
      
      while (current < end) {
        const dateStr = format(current, 'yyyy-MM-dd')
        if (blockedNightsSet.has(dateStr)) {
          // A night in range is blocked - reset to first date only
          onChange({ from: range.from, to: null })
          return
        }
        current = addDays(current, 1)
      }
    }
    
    onChange(range)
    
    // Close when both dates selected and different
    if (range.from && range.to && !isSameDay(range.from, range.to)) {
      setTimeout(() => setOpen(false), 200)
    }
  }, [onChange, isDateDisabled, blockedNightsSet])
  
  // Format display text (shows NIGHTS count)
  const displayText = React.useMemo(() => {
    if (isLoading) {
      return language === 'ru' ? 'Загрузка...' : 'Loading...'
    }
    if (!value?.from) {
      return language === 'ru' ? 'Заезд — Выезд' : 'Check-in — Check-out'
    }
    if (!value.to || isSameDay(value.from, value.to)) {
      return `${format(value.from, 'd MMM', { locale })} — ...`
    }
    
    const nights = differenceInDays(value.to, value.from)
    const nightsText = language === 'ru' 
      ? `${nights} ${nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}`
      : `${nights} night${nights > 1 ? 's' : ''}`
    
    return `${format(value.from, 'd MMM', { locale })} — ${format(value.to, 'd MMM', { locale })} (${nightsText})`
  }, [value, locale, language, isLoading])

  // Get default class names from react-day-picker
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

  // Full DayPicker with custom blocking component
  const CalendarContent = isLoading ? (
    <CalendarSkeleton />
  ) : (
    <DayPicker
      mode="range"
      selected={value}
      onSelect={handleSelect}
      locale={locale}
      disabled={isDateDisabled}
      numberOfMonths={numberOfMonths}
      showOutsideDays={false}
      captionLayout="label"
      className={cn(
        "bg-background group/calendar p-3 [--cell-size:2.5rem] md:[--cell-size:2.5rem]",
        isMobile && "[--cell-size:2.8rem]"
      )}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn("relative flex flex-col gap-4 md:flex-row", defaultClassNames.months),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1",
          defaultClassNames.nav
        ),
        button_previous: cn(
          buttonVariants({ variant: "ghost" }),
          "h-[--cell-size] w-[--cell-size] select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_previous
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost" }),
          "h-[--cell-size] w-[--cell-size] select-none p-0 aria-disabled:opacity-50",
          defaultClassNames.button_next
        ),
        month_caption: cn(
          "flex h-[--cell-size] w-full items-center justify-center px-[--cell-size]",
          defaultClassNames.month_caption
        ),
        caption_label: cn("select-none font-medium text-sm", defaultClassNames.caption_label),
        table: "w-full border-collapse",
        weekdays: cn("flex", defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground flex-1 select-none rounded-md text-[0.8rem] font-normal",
          defaultClassNames.weekday
        ),
        week: cn("mt-2 flex w-full", defaultClassNames.week),
        day: cn(
          "group/day relative aspect-square h-full w-full select-none p-0 text-center",
          defaultClassNames.day
        ),
        // Range styles with Teal color
        range_start: cn("bg-teal-600 rounded-l-md", defaultClassNames.range_start),
        range_middle: cn("bg-teal-100 rounded-none", defaultClassNames.range_middle),
        range_end: cn("bg-teal-600 rounded-r-md", defaultClassNames.range_end),
        today: cn(
          "ring-2 ring-teal-400 ring-inset rounded-md",
          defaultClassNames.today
        ),
        outside: cn(
          "text-muted-foreground aria-selected:text-muted-foreground opacity-30",
          defaultClassNames.outside
        ),
        // HARD BLOCKING STYLES
        disabled: cn(
          "text-slate-300 opacity-40 pointer-events-none cursor-not-allowed",
          defaultClassNames.disabled
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
      }}
      components={{
        Chevron: ChevronComponent,
        DayButton: BlockingDayButton,
      }}
    />
  )

  // Wrap calendar in context provider
  const CalendarWithContext = (
    <BlockedNightsContext.Provider value={{ blockedNightsSet, checkoutDaysSet }}>
      {CalendarContent}
    </BlockedNightsContext.Provider>
  )

  // Selection hint (first date selected)
  const SelectionHint = value?.from && (!value?.to || isSameDay(value.from, value.to)) && !isLoading ? (
    <div className="mb-3 text-center text-sm text-teal-600 bg-teal-50 rounded-lg py-2 px-3">
      {language === 'ru' 
        ? '✓ Заезд выбран. Выберите дату выезда'
        : '✓ Check-in selected. Select check-out date'}
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
            <div className="flex justify-center">
              {CalendarWithContext}
            </div>
            {RangeDisplay}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // Desktop: Popover
  return (
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        {TriggerButton}
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-4" 
        align="start" 
        sideOffset={4}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {SelectionHint}
        {CalendarWithContext}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Check if a date range has any blocked NIGHTS
 * For stay check_in to check_out, checks nights from check_in to check_out - 1
 * 
 * Example: Stay from 14 to 16 (2 nights)
 * Checks: 14 and 15 (the nights you're sleeping)
 * Does NOT check 16 (check-out day, not a night you're booking)
 */
export function hasBlockedNightInRange(checkIn, checkOut, blockedNights) {
  if (!checkIn || !checkOut || !blockedNights.length) return false
  
  const start = startOfDay(typeof checkIn === 'string' ? parseISO(checkIn) : checkIn)
  const end = startOfDay(typeof checkOut === 'string' ? parseISO(checkOut) : checkOut)
  const blockedSet = new Set(blockedNights)
  
  // Check all nights from check_in to check_out - 1
  let current = start
  while (current < end) {
    const dateStr = format(current, 'yyyy-MM-dd')
    if (blockedSet.has(dateStr)) return true
    current = addDays(current, 1)
  }
  
  return false
}

// Backwards compatibility alias
export const hasBlockedDateInRange = hasBlockedNightInRange

export default BookingDateRangePicker
