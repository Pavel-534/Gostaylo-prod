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

// Hook to detect mobile - returns null during SSR
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
      {/* Month header */}
      <div className="flex items-center justify-between px-1">
        <Skeleton className="h-5 w-5 rounded" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-5 rounded" />
      </div>
      {/* Day names */}
      <div className="grid grid-cols-7 gap-1">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-8 w-8 mx-auto" />
        ))}
      </div>
      {/* Calendar grid */}
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
 * Server-First Date Range Picker
 * 
 * Features:
 * - Skeleton loading state while fetching blockedDates
 * - Strict disabled dates from API (grey, unclickable)
 * - Single session range selection (drawer stays open until both dates selected)
 * - Mobile: Drawer (bottom sheet)
 * - Desktop: Popover
 * - NO auto-submit or auto-redirect
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
  
  // Memoize blocked dates for performance
  const blockedDateSet = React.useMemo(() => {
    return new Set(blockedDates)
  }, [blockedDates])
  
  const blockedDateObjects = React.useMemo(() => {
    return blockedDates.map(d => {
      try { return startOfDay(parseISO(d)) }
      catch { return null }
    }).filter(Boolean)
  }, [blockedDates])
  
  // Strict disabled date checker
  const isDateDisabled = React.useCallback((date) => {
    const d = startOfDay(date)
    const today = startOfDay(new Date())
    
    // Past dates always disabled
    if (isBefore(d, today)) return true
    
    // Check against blocked dates from API
    const dateStr = format(d, 'yyyy-MM-dd')
    return blockedDateSet.has(dateStr)
  }, [blockedDateSet])
  
  // Handle range selection - stay open until both dates selected
  const handleSelect = React.useCallback((range) => {
    if (!range) {
      onChange({ from: null, to: null })
      return
    }
    
    // If clicking a disabled date, ignore
    if (range.from && isDateDisabled(range.from)) return
    if (range.to && isDateDisabled(range.to)) {
      onChange({ from: range.from, to: null })
      return
    }
    
    // Check if any date in range is blocked (only if both dates selected)
    if (range.from && range.to && !isSameDay(range.from, range.to)) {
      let current = startOfDay(range.from)
      const end = startOfDay(range.to)
      while (current < end) {
        if (isDateDisabled(current)) {
          // Range contains blocked date - reset to first date only
          onChange({ from: range.from, to: null })
          return
        }
        current = addDays(current, 1)
      }
    }
    
    onChange(range)
    
    // Close ONLY when both dates are selected AND different
    if (range.from && range.to && !isSameDay(range.from, range.to)) {
      setTimeout(() => setOpen(false), 200)
    }
  }, [onChange, isDateDisabled])
  
  // Format display text
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

  // Calendar content with loading state
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

  // Selection hint
  const SelectionHint = value?.from && (!value?.to || isSameDay(value.from, value.to)) && !isLoading ? (
    <div className="mb-3 text-center text-sm text-teal-600 bg-teal-50 rounded-lg py-2 px-3">
      {language === 'ru' 
        ? '✓ Заезд выбран. Выберите дату выезда'
        : '✓ Check-in selected. Now select check-out'}
    </div>
  ) : null

  // Selected range display (mobile only)
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
 * Check if a date range contains any blocked date
 */
export function hasBlockedDateInRange(startDate, endDate, blockedDates) {
  if (!startDate || !endDate || !blockedDates.length) return false
  
  const start = startOfDay(typeof startDate === 'string' ? parseISO(startDate) : startDate)
  const end = startOfDay(typeof endDate === 'string' ? parseISO(endDate) : endDate)
  const blockedSet = new Set(blockedDates)
  
  let current = start
  while (current < end) {
    const dateStr = format(current, 'yyyy-MM-dd')
    if (blockedSet.has(dateStr)) return true
    current = addDays(current, 1)
  }
  
  return false
}

export default BookingDateRangePicker
