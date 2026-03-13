'use client'

/**
 * SearchCalendar - Simplified Calendar for Search Bar
 * 
 * Unlike GostayloCalendar (which requires a listingId for pricing data),
 * this component is for date selection only - used in search bars
 * 
 * Features:
 * - Mobile: Vertical scroll in Drawer
 * - Desktop: Popover with 2 months
 * - Clean Airbnb-style UI
 * - Live count integration
 * 
 * @created 2026-03-13
 */

import * as React from "react"
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, isSameDay, isSameMonth, isBefore, differenceInDays } from "date-fns"
import { ru, enUS } from "date-fns/locale"
import { ChevronLeft, ChevronRight, CalendarIcon, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer"
import { Badge } from "@/components/ui/badge"

const locales = { ru, en: enUS }

function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  return isMobile
}

/**
 * Simple Day Cell for Search Calendar
 */
function SearchDayCell({ 
  date, 
  isSelected, 
  isRangeStart, 
  isRangeEnd, 
  isInRange,
  onSelect,
  locale
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const isToday = isSameDay(date, today)
  const isPast = isBefore(date, today)
  const isClickable = !isPast
  
  const handleClick = () => {
    if (isClickable) {
      onSelect(date)
    }
  }
  
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isClickable}
      className={cn(
        "relative w-10 h-10 flex items-center justify-center text-sm transition-all rounded-full",
        isPast && "text-slate-300 cursor-not-allowed",
        !isPast && "hover:bg-teal-50",
        isToday && !isSelected && "font-bold",
        isRangeStart && "bg-teal-600 text-white rounded-r-none",
        isRangeEnd && "bg-teal-600 text-white rounded-l-none",
        isInRange && !isRangeStart && !isRangeEnd && "bg-teal-100 text-teal-900 rounded-none",
        isSelected && !isRangeStart && !isRangeEnd && "bg-teal-600 text-white"
      )}
    >
      {date.getDate()}
    </button>
  )
}

/**
 * Month Grid Component
 */
function MonthGrid({ 
  month, 
  dateRange, 
  onSelect, 
  locale,
  showHeader = true
}) {
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })
  
  const loc = locales[locale] || enUS
  const weekDays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
  if (locale !== 'ru') {
    weekDays.splice(0, 7, 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su')
  }
  
  // Build weeks array
  const weeks = []
  let currentDate = startDate
  while (currentDate <= endDate) {
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push(new Date(currentDate))
      currentDate = addDays(currentDate, 1)
    }
    weeks.push(week)
  }
  
  return (
    <div className="p-2">
      {showHeader && (
        <h3 className="text-center font-semibold text-slate-800 mb-3 capitalize">
          {format(month, 'LLLL yyyy', { locale: loc })}
        </h3>
      )}
      
      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((day, i) => (
          <div key={i} className="w-10 h-8 flex items-center justify-center text-xs text-slate-400 font-medium">
            {day}
          </div>
        ))}
      </div>
      
      {/* Days grid */}
      <div className="space-y-1">
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7">
            {week.map((date, dayIdx) => {
              const inMonth = isSameMonth(date, month)
              if (!inMonth) {
                return <div key={dayIdx} className="w-10 h-10" />
              }
              
              const isRangeStart = dateRange.from && isSameDay(date, dateRange.from)
              const isRangeEnd = dateRange.to && isSameDay(date, dateRange.to)
              const isInRange = dateRange.from && dateRange.to && 
                date > dateRange.from && date < dateRange.to
              const isSelected = isRangeStart || isRangeEnd
              
              return (
                <SearchDayCell
                  key={dayIdx}
                  date={date}
                  isSelected={isSelected}
                  isRangeStart={isRangeStart}
                  isRangeEnd={isRangeEnd}
                  isInRange={isInRange}
                  onSelect={onSelect}
                  locale={locale}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Desktop Popover Calendar
 */
function DesktopCalendar({ dateRange, onSelect, onClear, locale }) {
  const [leftMonth, setLeftMonth] = React.useState(() => new Date())
  const rightMonth = addMonths(leftMonth, 1)
  
  const prevMonth = () => setLeftMonth(addMonths(leftMonth, -1))
  const nextMonth = () => setLeftMonth(addMonths(leftMonth, 1))
  
  const canGoPrev = leftMonth > new Date()
  
  return (
    <div className="p-2">
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-2 px-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={prevMonth}
          disabled={!canGoPrev}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextMonth}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Two Months */}
      <div className="flex gap-4">
        <MonthGrid
          month={leftMonth}
          dateRange={dateRange}
          onSelect={onSelect}
          locale={locale}
        />
        <MonthGrid
          month={rightMonth}
          dateRange={dateRange}
          onSelect={onSelect}
          locale={locale}
        />
      </div>
      
      {/* Clear Button */}
      {dateRange.from && (
        <div className="flex justify-end mt-2 px-2">
          <Button variant="ghost" size="sm" onClick={onClear} className="text-slate-500 h-8">
            <X className="h-3 w-3 mr-1" />
            {locale === 'ru' ? 'Сбросить' : 'Clear'}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Mobile Drawer Calendar - Vertical Scroll
 */
function MobileCalendarDrawer({ 
  open, 
  onOpenChange, 
  dateRange, 
  onSelect,
  onConfirm,
  onClear,
  locale,
  liveCount,
  countLoading 
}) {
  const [tempRange, setTempRange] = React.useState(dateRange)
  const months = React.useMemo(() => 
    Array.from({ length: 12 }, (_, i) => addMonths(new Date(), i)), 
  [])
  
  React.useEffect(() => {
    if (open) {
      setTempRange(dateRange)
    }
  }, [open, dateRange])
  
  const handleSelect = (date) => {
    if (!tempRange.from || (tempRange.from && tempRange.to)) {
      // Start new selection
      setTempRange({ from: date, to: null })
    } else {
      // Complete selection
      if (date < tempRange.from) {
        setTempRange({ from: date, to: tempRange.from })
      } else {
        setTempRange({ from: tempRange.from, to: date })
      }
    }
  }
  
  const handleConfirm = () => {
    onSelect(tempRange)
    onConfirm?.()
  }
  
  const handleClear = () => {
    setTempRange({ from: null, to: null })
  }
  
  const loc = locales[locale] || enUS
  const nights = tempRange.from && tempRange.to 
    ? differenceInDays(tempRange.to, tempRange.from) : 0
  
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[85vh] max-h-[85vh]">
        <DrawerHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-lg font-semibold">
              {locale === 'ru' ? 'Выберите даты' : 'Select dates'}
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </div>
          
          {/* Selection Summary */}
          {nights > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-teal-100 text-teal-700">
                {format(tempRange.from, 'd MMM', { locale: loc })} — {format(tempRange.to, 'd MMM', { locale: loc })}
              </Badge>
              <Badge variant="outline" className="border-teal-300 text-teal-600">
                {nights} {locale === 'ru' ? (nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей') : `night${nights > 1 ? 's' : ''}`}
              </Badge>
            </div>
          )}
        </DrawerHeader>
        
        {/* Vertical Scroll Months */}
        <div className="flex-1 overflow-y-auto px-2">
          {months.map((month, idx) => (
            <div key={idx} className="py-2">
              <MonthGrid
                month={month}
                dateRange={tempRange}
                onSelect={handleSelect}
                locale={locale}
                showHeader={true}
              />
            </div>
          ))}
        </div>
        
        {/* Footer with Actions */}
        <DrawerFooter className="border-t pt-3 pb-4">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-11"
              onClick={handleClear}
            >
              {locale === 'ru' ? 'Сбросить' : 'Clear'}
            </Button>
            <Button 
              className="flex-1 h-11 bg-teal-600 hover:bg-teal-700 text-white font-medium"
              onClick={handleConfirm}
              disabled={!tempRange.from || !tempRange.to}
              data-testid="search-calendar-confirm"
            >
              {countLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {locale === 'ru' ? 'Показать' : 'Show'} {liveCount !== null ? liveCount : ''} {locale === 'ru' ? 'вариантов' : 'options'}
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * Main SearchCalendar Component
 */
export function SearchCalendar({
  value,
  onChange,
  locale = 'en',
  placeholder,
  liveCount = null,
  countLoading = false,
  onConfirm,
  className
}) {
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [popoverOpen, setPopoverOpen] = React.useState(false)
  
  const dateRange = value || { from: null, to: null }
  const loc = locales[locale] || enUS
  
  const nights = dateRange.from && dateRange.to 
    ? differenceInDays(dateRange.to, dateRange.from) : 0
  
  const handleSelect = (date) => {
    if (typeof date === 'object' && 'from' in date) {
      // Full range passed (from mobile drawer)
      onChange(date)
      return
    }
    
    // Single date clicked
    if (!dateRange.from || (dateRange.from && dateRange.to)) {
      onChange({ from: date, to: null })
    } else {
      if (date < dateRange.from) {
        onChange({ from: date, to: dateRange.from })
      } else {
        onChange({ from: dateRange.from, to: date })
      }
      setPopoverOpen(false)
    }
  }
  
  const handleClear = () => {
    onChange({ from: null, to: null })
  }
  
  const handleMobileConfirm = () => {
    setDrawerOpen(false)
    onConfirm?.()
  }
  
  // Display text
  const displayText = React.useMemo(() => {
    if (dateRange.from && dateRange.to && !isSameDay(dateRange.from, dateRange.to)) {
      return `${format(dateRange.from, 'd MMM', { locale: loc })} — ${format(dateRange.to, 'd MMM', { locale: loc })}`
    }
    if (dateRange.from) {
      return `${format(dateRange.from, 'd MMM', { locale: loc })} — ...`
    }
    return placeholder || (locale === 'ru' ? 'Даты' : 'Dates')
  }, [dateRange, locale, loc, placeholder])
  
  // Trigger button content
  const TriggerContent = (
    <>
      <CalendarIcon className="h-4 w-4 text-teal-600 flex-shrink-0" />
      <span className={cn(
        "text-sm truncate",
        dateRange.from ? "text-slate-900" : "text-slate-500"
      )}>
        {displayText}
      </span>
      {nights > 0 && (
        <Badge variant="secondary" className="ml-auto bg-teal-100 text-teal-700 text-xs">
          {nights}{locale === 'ru' ? 'н.' : 'n.'}
        </Badge>
      )}
    </>
  )
  
  // Mobile: Use Drawer
  if (isMobile) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors",
            className
          )}
          data-testid="search-calendar-trigger"
        >
          {TriggerContent}
        </button>
        
        <MobileCalendarDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          dateRange={dateRange}
          onSelect={handleSelect}
          onConfirm={handleMobileConfirm}
          onClear={handleClear}
          locale={locale}
          liveCount={liveCount}
          countLoading={countLoading}
        />
      </>
    )
  }
  
  // Desktop: Use Popover
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors",
            className
          )}
          data-testid="search-calendar-trigger"
        >
          {TriggerContent}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <DesktopCalendar
          dateRange={dateRange}
          onSelect={handleSelect}
          onClear={handleClear}
          locale={locale}
        />
      </PopoverContent>
    </Popover>
  )
}

export default SearchCalendar
