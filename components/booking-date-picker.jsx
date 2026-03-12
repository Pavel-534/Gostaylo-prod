'use client'

import * as React from "react"
import { format, parseISO, startOfDay, addDays, isSameDay, isBefore, differenceInDays } from "date-fns"
import { ru, enUS, zhCN, th } from "date-fns/locale"
import { CalendarIcon, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
 * - Calendar disables only dates in blockedNights array
 * - No "X dates unavailable" warning - purely disabled prop handling
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

  // Calendar content
  const CalendarContent = isLoading ? (
    <CalendarSkeleton />
  ) : (
    <Calendar
      mode="range"
      selected={value}
      onSelect={handleSelect}
      locale={locale}
      disabled={isDateDisabled}
      numberOfMonths={numberOfMonths}
      showOutsideDays={false}
      captionLayout="label"
      className={cn(
        "p-0",
        isMobile && "[--cell-size:2.8rem]"
      )}
    />
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
              {CalendarContent}
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
        {CalendarContent}
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
