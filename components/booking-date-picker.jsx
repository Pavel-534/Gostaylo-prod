'use client'

import * as React from "react"
import { format, parseISO, startOfDay, addDays, isSameDay, isBefore } from "date-fns"
import { ru, enUS, zhCN, th } from "date-fns/locale"
import { CalendarIcon, Ban } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

const locales = { ru, en: enUS, zh: zhCN, th }

/**
 * DateRangePicker with blocked dates support
 * Dates are grayed out and unclickable if they are in the blockedDates array
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
  
  // Convert blocked date strings to Date objects for comparison
  const blockedDateObjects = React.useMemo(() => {
    return blockedDates.map(dateStr => startOfDay(parseISO(dateStr)))
  }, [blockedDates])
  
  // Function matcher for disabled dates - react-day-picker v9 uses this format
  const isDateDisabled = React.useCallback((date) => {
    const checkDate = startOfDay(date)
    
    // Check if before minDate
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
  
  const handleSelect = (date) => {
    if (date && !isDateDisabled(date)) {
      onChange(format(date, 'yyyy-MM-dd'))
      setOpen(false)
    }
  }
  
  const selectedDate = value ? parseISO(value) : undefined
  const locale = locales[language] || locales.ru
  
  return (
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
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          disabled={isDateDisabled}
          initialFocus
        />
        {blockedDates.length > 0 && (
          <div className="px-3 pb-3 text-xs text-amber-600 flex items-center gap-1">
            <Ban className="h-3 w-3" />
            {language === 'ru' 
              ? `${blockedDates.length} дат недоступны`
              : language === 'zh'
              ? `${blockedDates.length} 日期不可用`
              : `${blockedDates.length} dates unavailable`}
          </div>
        )}
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
  
  // Check each day in range
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
