'use client'

import * as React from "react"
import { format, parseISO, startOfDay, addDays, isSameDay, isBefore, differenceInDays } from "date-fns"
import { ru, enUS, zhCN, th } from "date-fns/locale"
import { CalendarIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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

// Hook to detect mobile viewport
function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)
  
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  return isMobile
}

/**
 * Professional Date Range Picker with Mobile Drawer
 * - Desktop: Popover
 * - Mobile: Full-height Drawer (bottom sheet)
 * - Range selection stays open until both dates selected
 * - Larger cell size on mobile (2.8rem)
 */
export function BookingDateRangePicker({
  value = { from: null, to: null },
  onChange,
  blockedDates = [],
  minDate,
  placeholder,
  language = "ru",
  className,
  disabled = false,
  numberOfMonths = 1,
  onRefreshAvailability,
  "data-testid": dataTestId
}) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobile()
  const locale = locales[language] || locales.ru
  
  // Memoize blocked dates for performance
  const blockedDateObjects = React.useMemo(() => {
    return blockedDates.map(dateStr => {
      try {
        return startOfDay(parseISO(dateStr))
      } catch {
        return null
      }
    }).filter(Boolean)
  }, [blockedDates])
  
  // Check if date is disabled
  const isDateDisabled = React.useCallback((date) => {
    const checkDate = startOfDay(date)
    const minDateObj = minDate ? startOfDay(new Date(minDate)) : startOfDay(new Date())
    
    if (isBefore(checkDate, minDateObj)) return true
    
    for (const blockedDate of blockedDateObjects) {
      if (isSameDay(checkDate, blockedDate)) return true
    }
    return false
  }, [blockedDateObjects, minDate])
  
  // Handle range selection - stay open until both dates selected
  const handleSelect = React.useCallback((range) => {
    if (!range) {
      onChange({ from: null, to: null })
      return
    }
    
    // Prevent selecting disabled dates
    if (range.from && isDateDisabled(range.from)) return
    if (range.to && isDateDisabled(range.to)) {
      onChange({ from: range.from, to: null })
      return
    }
    
    // Check for blocked dates in range (only if both dates selected and different)
    if (range.from && range.to && !isSameDay(range.from, range.to)) {
      let current = startOfDay(range.from)
      const end = startOfDay(range.to)
      while (current <= end) {
        if (isDateDisabled(current)) {
          onChange({ from: range.from, to: null })
          return
        }
        current = addDays(current, 1)
      }
    }
    
    onChange(range)
    
    // ONLY close when BOTH dates are selected AND they are DIFFERENT
    // (react-day-picker initially sets from=to when first click)
    if (range.from && range.to && !isSameDay(range.from, range.to)) {
      setTimeout(() => setOpen(false), 200)
    }
  }, [onChange, isDateDisabled])
  
  // Format display text
  const displayText = React.useMemo(() => {
    if (!value?.from) {
      return placeholder || (language === 'ru' ? 'Заезд — Выезд' : 'Check-in — Check-out')
    }
    // If same day selected (first click) or no end date - show waiting for end date
    if (!value.to || isSameDay(value.from, value.to)) {
      return `${format(value.from, 'd MMM', { locale })} — ...`
    }
    const nights = differenceInDays(value.to, value.from)
    const nightsLabel = language === 'ru' 
      ? `${nights} ${nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}`
      : `${nights} night${nights > 1 ? 's' : ''}`
    return `${format(value.from, 'd MMM', { locale })} — ${format(value.to, 'd MMM', { locale })} (${nightsLabel})`
  }, [value, locale, language, placeholder])

  // Trigger button
  const TriggerButton = (
    <Button
      variant="outline"
      disabled={disabled}
      data-testid={dataTestId}
      className={cn(
        "w-full h-12 justify-start text-left font-normal",
        !value?.from && "text-muted-foreground",
        className
      )}
    >
      <CalendarIcon className="mr-2 h-4 w-4 text-slate-500 flex-shrink-0" />
      <span className="truncate">{displayText}</span>
    </Button>
  )

  // Calendar with proper styling
  const CalendarContent = (
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
        // Mobile: larger cells for touch targets
        isMobile && "[--cell-size:2.8rem]"
      )}
    />
  )

  // Mobile: Use Drawer (bottom sheet)
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <div onClick={() => setOpen(true)}>
          {TriggerButton}
        </div>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="relative border-b pb-4">
            <DrawerTitle className="text-center">
              {language === 'ru' ? 'Выберите даты' : 'Select dates'}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="absolute right-2 top-2"
              >
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="flex-1 overflow-auto p-4">
            {/* Selection hint - show when first date selected but not second */}
            {value?.from && (!value?.to || isSameDay(value.from, value.to)) && (
              <div className="mb-4 text-center text-sm text-teal-600 bg-teal-50 rounded-lg py-2">
                {language === 'ru' 
                  ? '✓ Заезд выбран. Теперь выберите дату выезда'
                  : '✓ Check-in selected. Now select check-out date'}
              </div>
            )}
            <div className="flex justify-center">
              {CalendarContent}
            </div>
            {/* Selected range display - only show when different dates */}
            {value?.from && value?.to && !isSameDay(value.from, value.to) && (
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
            )}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  // Desktop: Use Popover
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {TriggerButton}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start" sideOffset={4}>
        {/* Selection hint for desktop - show when first date selected */}
        {value?.from && (!value?.to || isSameDay(value.from, value.to)) && (
          <div className="mb-3 text-center text-sm text-teal-600 bg-teal-50 rounded-lg py-2 px-3">
            {language === 'ru' 
              ? '✓ Заезд выбран. Выберите дату выезда'
              : '✓ Check-in selected. Select check-out'}
          </div>
        )}
        {CalendarContent}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Single Date Picker (backwards compatible)
 */
export function BookingDatePicker({
  value,
  onChange,
  blockedDates = [],
  minDate,
  placeholder = "Выберите дату",
  language = "ru",
  className,
  disabled = false,
  "data-testid": dataTestId
}) {
  const [open, setOpen] = React.useState(false)
  const isMobile = useIsMobile()
  const locale = locales[language] || locales.ru
  
  const blockedDateObjects = React.useMemo(() => {
    return blockedDates.map(dateStr => {
      try {
        return startOfDay(parseISO(dateStr))
      } catch {
        return null
      }
    }).filter(Boolean)
  }, [blockedDates])
  
  const isDateDisabled = React.useCallback((date) => {
    const checkDate = startOfDay(date)
    const minDateObj = minDate ? startOfDay(new Date(minDate)) : startOfDay(new Date())
    
    if (isBefore(checkDate, minDateObj)) return true
    
    for (const blockedDate of blockedDateObjects) {
      if (isSameDay(checkDate, blockedDate)) return true
    }
    return false
  }, [blockedDateObjects, minDate])
  
  const handleSelect = (date) => {
    if (date && !isDateDisabled(date)) {
      onChange(format(date, 'yyyy-MM-dd'))
      setOpen(false)
    }
  }
  
  const selectedDate = value ? parseISO(value) : undefined
  
  const TriggerButton = (
    <Button
      variant="outline"
      disabled={disabled}
      data-testid={dataTestId}
      className={cn(
        "w-full h-12 justify-start text-left font-normal",
        !value && "text-muted-foreground",
        className
      )}
    >
      <CalendarIcon className="mr-2 h-4 w-4" />
      {value ? format(parseISO(value), "d MMMM yyyy", { locale }) : placeholder}
    </Button>
  )

  const CalendarContent = (
    <Calendar
      mode="single"
      selected={selectedDate}
      onSelect={handleSelect}
      locale={locale}
      disabled={isDateDisabled}
      showOutsideDays={false}
      captionLayout="label"
      className={isMobile ? "[--cell-size:2.8rem]" : ""}
    />
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <div onClick={() => setOpen(true)}>
          {TriggerButton}
        </div>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="relative border-b pb-4">
            <DrawerTitle className="text-center">{placeholder}</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="absolute right-2 top-2">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <div className="flex justify-center p-4">
            {CalendarContent}
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {TriggerButton}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        {CalendarContent}
      </PopoverContent>
    </Popover>
  )
}

/**
 * Check if a date range overlaps with any blocked date
 */
export function hasBlockedDateInRange(startDate, endDate, blockedDates) {
  if (!startDate || !endDate || !blockedDates.length) return false
  
  const start = startOfDay(typeof startDate === 'string' ? parseISO(startDate) : startDate)
  const end = startOfDay(typeof endDate === 'string' ? parseISO(endDate) : endDate)
  
  let current = start
  while (current < end) {
    const dateStr = format(current, 'yyyy-MM-dd')
    if (blockedDates.includes(dateStr)) return true
    current = addDays(current, 1)
  }
  
  return false
}

export default BookingDatePicker
