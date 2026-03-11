'use client'

import * as React from "react"
import { format, parseISO, startOfDay, addDays, isSameDay, isBefore, differenceInDays } from "date-fns"
import { ru, enUS, zhCN, th } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { DayPicker } from "react-day-picker"
import "react-day-picker/style.css"

const locales = { ru, en: enUS, zh: zhCN, th }

// Custom CSS for teal accent color and disabled dates
const calendarStyles = `
  .rdp-root {
    --rdp-accent-color: #0d9488;
    --rdp-accent-background-color: #ccfbf1;
    --rdp-range_start-date-background-color: #0d9488;
    --rdp-range_end-date-background-color: #0d9488;
    --rdp-range_middle-background-color: #ccfbf1;
  }
  .rdp-day_button:disabled {
    color: #cbd5e1;
    opacity: 0.5;
    cursor: not-allowed;
  }
  .rdp-day_button:disabled:hover {
    background: transparent;
  }
`

/**
 * Professional Airbnb-style Date Range Picker
 * - mode="range" for check-in/check-out selection
 * - Visible month/year navigation (standard react-day-picker v9)
 * - Blocked dates appear as muted/disabled
 * - Uses useMemo for performance on mobile
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
  "data-testid": dataTestId
}) {
  const [open, setOpen] = React.useState(false)
  const locale = locales[language] || locales.ru
  
  // Memoize blocked dates conversion for performance
  const blockedDateObjects = React.useMemo(() => {
    return blockedDates.map(dateStr => {
      try {
        return startOfDay(parseISO(dateStr))
      } catch {
        return null
      }
    }).filter(Boolean)
  }, [blockedDates])
  
  // Memoize disabled date checker
  const isDateDisabled = React.useCallback((date) => {
    const checkDate = startOfDay(date)
    
    // Check if before minDate (default: today)
    const minDateObj = minDate ? startOfDay(new Date(minDate)) : startOfDay(new Date())
    if (isBefore(checkDate, minDateObj)) {
      return true
    }
    
    // Check if date is in blocked dates
    for (const blockedDate of blockedDateObjects) {
      if (isSameDay(checkDate, blockedDate)) {
        return true
      }
    }
    
    return false
  }, [blockedDateObjects, minDate])
  
  // Handle range selection
  const handleSelect = React.useCallback((range) => {
    if (!range) {
      onChange({ from: null, to: null })
      return
    }
    
    // If selecting a blocked date, ignore
    if (range.from && isDateDisabled(range.from)) {
      return
    }
    if (range.to && isDateDisabled(range.to)) {
      // Allow partial selection (from only)
      onChange({ from: range.from, to: null })
      return
    }
    
    // Check if any date in range is blocked
    if (range.from && range.to) {
      let current = startOfDay(range.from)
      const end = startOfDay(range.to)
      while (current <= end) {
        if (isDateDisabled(current)) {
          // Stop selection at blocked date
          onChange({ from: range.from, to: null })
          return
        }
        current = addDays(current, 1)
      }
    }
    
    onChange(range)
    
    // Close popover when full range selected
    if (range.from && range.to) {
      setTimeout(() => setOpen(false), 150)
    }
  }, [onChange, isDateDisabled])
  
  // Format display text
  const displayText = React.useMemo(() => {
    if (!value?.from) {
      return placeholder || (language === 'ru' ? 'Выберите даты' : 'Select dates')
    }
    if (!value.to) {
      return format(value.from, 'd MMM', { locale })
    }
    const nights = differenceInDays(value.to, value.from)
    const nightsText = language === 'ru' 
      ? `${nights} ${nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей'}`
      : `${nights} night${nights > 1 ? 's' : ''}`
    return `${format(value.from, 'd MMM', { locale })} — ${format(value.to, 'd MMM', { locale })} (${nightsText})`
  }, [value, locale, language, placeholder])

  return (
    <>
      <style>{calendarStyles}</style>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            data-testid={dataTestId}
            className={cn(
              "w-full h-10 justify-start text-left font-normal",
              !value?.from && "text-muted-foreground",
              className
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-slate-400 flex-shrink-0" />
            <span className="truncate text-sm">{displayText}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start" sideOffset={4}>
          <DayPicker
            mode="range"
            selected={value}
            onSelect={handleSelect}
            locale={locale}
            disabled={isDateDisabled}
            numberOfMonths={numberOfMonths}
            showOutsideDays={false}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}

/**
 * Single Date Picker (for check-in only or standalone use)
 * Keeps the original BookingDatePicker API for backwards compatibility
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
  const locale = locales[language] || locales.ru
  
  // Memoize blocked dates conversion for performance
  const blockedDateObjects = React.useMemo(() => {
    return blockedDates.map(dateStr => {
      try {
        return startOfDay(parseISO(dateStr))
      } catch {
        return null
      }
    }).filter(Boolean)
  }, [blockedDates])
  
  // Memoize disabled date checker
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
  
  return (
    <>
      <style>{calendarStyles}</style>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
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
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <DayPicker
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={locale}
            disabled={isDateDisabled}
            showOutsideDays={false}
          />
        </PopoverContent>
      </Popover>
    </>
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
    if (blockedDates.includes(dateStr)) {
      return true
    }
    current = addDays(current, 1)
  }
  
  return false
}

export default BookingDatePicker
