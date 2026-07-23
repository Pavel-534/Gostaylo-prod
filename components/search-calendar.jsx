'use client'

/**
 * SearchCalendar - Simplified Calendar for Search Bar
 * 
 * Unlike PlatformCalendar (requires a listingId for pricing data),
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
import { formatDisplayDate } from "@/lib/date-display-format"

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
        "relative w-10 h-10 flex items-center justify-center text-sm transition-colors rounded-full",
        "text-slate-900 dark:text-slate-100",
        isPast && "text-slate-300 dark:text-slate-600 cursor-not-allowed",
        !isPast && !isSelected && !isInRange && "hover:bg-brand/10 dark:hover:bg-brand/20",
        isToday && !isSelected && "font-bold ring-2 ring-brand/50 ring-inset",
        isRangeStart &&
          "bg-brand text-white shadow-md ring-2 ring-brand ring-offset-1 ring-offset-white dark:ring-offset-slate-900 rounded-r-none z-10",
        isRangeEnd &&
          "bg-brand text-white shadow-md ring-2 ring-brand ring-offset-1 ring-offset-white dark:ring-offset-slate-900 rounded-l-none z-10",
        isRangeStart && isRangeEnd && "rounded-full",
        isInRange &&
          !isRangeStart &&
          !isRangeEnd &&
          "bg-brand/25 text-brand-hover dark:bg-brand/35 dark:text-brand rounded-none",
        isSelected && !isRangeStart && !isRangeEnd && "bg-brand text-white shadow-md"
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
    <div className="p-3">
      {showHeader && (
        <h3 className="mb-3 text-center text-lg font-medium capitalize text-slate-900">
          {format(month, 'LLLL yyyy', { locale: loc })}
        </h3>
      )}
      
      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-1">
        {weekDays.map((day, i) => (
          <div key={i} className="flex h-8 w-10 items-center justify-center text-xs font-medium text-slate-900">
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
    <div className="p-4 lg:p-6">
      {/* Navigation Header */}
      <div className="mb-3 flex items-center justify-between px-2">
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
      <div className="flex gap-6">
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
        <div className="mt-3 flex justify-end px-2">
          <Button variant="ghost" size="sm" onClick={onClear} className="h-8 text-slate-900">
            <X className="h-3 w-3 mr-1" />
            {locale === 'ru' ? 'Сбросить' : 'Clear'}
          </Button>
        </div>
      )}
    </div>
  )
}

/**
 * Inline calendar panel (wizard step — no Drawer/Popover wrapper).
 */
function WizardCalendarPanel({ dateRange, onSelect, onClear, locale }) {
  const months = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => addMonths(new Date(), i)),
    [],
  )

  const handleSelect = (date) => {
    if (!dateRange.from || (dateRange.from && dateRange.to)) {
      onSelect({ from: date, to: null })
      return
    }
    if (isSameDay(date, dateRange.from)) {
      onSelect({ from: dateRange.from, to: addDays(dateRange.from, 1) })
      return
    }
    if (date < dateRange.from) {
      onSelect({ from: date, to: dateRange.from })
    } else {
      onSelect({ from: dateRange.from, to: date })
    }
  }

  const nights =
    dateRange.from && dateRange.to ? differenceInDays(dateRange.to, dateRange.from) : 0

  return (
    <div data-testid="search-calendar-wizard-step">
      {dateRange.from && dateRange.to && nights > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="bg-brand/15 text-brand-hover">
            {formatDisplayDate(dateRange.from)} — {formatDisplayDate(dateRange.to)}
          </Badge>
          <Badge variant="outline" className="border-brand/30 text-brand">
            {nights}{' '}
            {locale === 'ru'
              ? nights === 1
                ? 'ночь'
                : nights < 5
                  ? 'ночи'
                  : 'ночей'
              : `night${nights > 1 ? 's' : ''}`}
          </Badge>
        </div>
      ) : null}
      {dateRange.from && !dateRange.to ? (
        <p className="mb-3 text-sm text-slate-500">
          {locale === 'ru' ? 'Выберите дату выезда' : 'Select checkout date'}
        </p>
      ) : null}
      <div className="space-y-1">
        {months.map((month, idx) => (
          <div key={idx} className="py-1">
            <MonthGrid
              month={month}
              dateRange={dateRange}
              onSelect={handleSelect}
              locale={locale}
              showHeader={true}
            />
          </div>
        ))}
      </div>
      {dateRange.from ? (
        <div className="mt-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClear} className="min-h-11 h-11 text-slate-900">
            <X className="mr-1 h-3 w-3" />
            {locale === 'ru' ? 'Сбросить' : 'Clear'}
          </Button>
        </div>
      ) : null}
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
      // Уже выбран заезд, ждём выезд
      if (isSameDay(date, tempRange.from)) {
        // Повторный тап по дню заезда (часто «сегодня»): иначе ветка else даёт 0 ночей и кажется, что «не сработало»
        setTempRange({ from: tempRange.from, to: addDays(tempRange.from, 1) })
        return
      }
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
  const canConfirm = Boolean(
    tempRange.from &&
      tempRange.to &&
      differenceInDays(tempRange.to, tempRange.from) >= 1,
  )
  
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        className="h-[85vh] max-h-[85vh]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
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
          {tempRange.from && tempRange.to && nights > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="secondary" className="bg-brand/15 text-brand-hover">
                {formatDisplayDate(tempRange.from)} — {formatDisplayDate(tempRange.to)}
              </Badge>
              <Badge variant="outline" className="border-brand/30 text-brand">
                {nights} {locale === 'ru' ? (nights === 1 ? 'ночь' : nights < 5 ? 'ночи' : 'ночей') : `night${nights > 1 ? 's' : ''}`}
              </Badge>
            </div>
          )}
          {tempRange.from && !tempRange.to && (
            <p className="text-sm text-slate-500 mt-2 text-left">
              {locale === 'ru' ? 'Выберите дату выезда' : 'Select checkout date'}
            </p>
          )}
        </DrawerHeader>
        
        {/* Vertical Scroll Months */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 overscroll-contain">
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
              className="flex-1 h-11 bg-brand hover:bg-brand-hover text-white font-medium"
              onClick={handleConfirm}
              disabled={!canConfirm}
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
  className,
  /** `wizardStep` — inline panel inside MobileSearchWizard (no nested Drawer/Popover). */
  presentation,
}) {
  const isMobile = useIsMobile()
  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [popoverOpen, setPopoverOpen] = React.useState(false)

  const isWizardStep = presentation === 'wizardStep'
  const useDrawerShell = !isWizardStep && (presentation === 'drawer' || (presentation == null && isMobile))
  const usePopoverShell = !isWizardStep && !useDrawerShell
  
  const dateRange = value || { from: null, to: null }
  const loc = locales[locale] || enUS
  
  const nights = dateRange.from && dateRange.to 
    ? differenceInDays(dateRange.to, dateRange.from) : 0
  
  const handleSelect = (date) => {
    if (typeof date === 'object' && 'from' in date) {
      // Full range passed (from mobile drawer)
      onChange(date)
      if (isWizardStep && date?.from && date?.to) {
        onConfirm?.()
      }
      return
    }

    // Single date clicked
    if (!dateRange.from || (dateRange.from && dateRange.to)) {
      onChange({ from: date, to: null })
    } else {
      const next =
        date < dateRange.from
          ? { from: date, to: dateRange.from }
          : { from: dateRange.from, to: date }
      onChange(next)
      setPopoverOpen(false)
      // Sheet wizard: complete range → parent advances (guests) or collapses.
      if (isWizardStep) onConfirm?.()
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
      return `${formatDisplayDate(dateRange.from)} — ${formatDisplayDate(dateRange.to)}`
    }
    if (dateRange.from) {
      return `${formatDisplayDate(dateRange.from)} — …`
    }
    return placeholder || (locale === 'ru' ? 'Даты' : 'Dates')
  }, [dateRange, locale, placeholder])
  
  // Trigger button content
  const TriggerContent = (
    <>
      <CalendarIcon className="h-5 w-5 text-brand flex-shrink-0" />
      <span className={cn(
        "text-base font-medium leading-none truncate",
        dateRange.from ? "text-slate-900" : "text-slate-500"
      )}>
        {displayText}
      </span>
      {nights > 0 && (
        <Badge variant="secondary" className="ml-auto bg-brand/15 text-brand-hover text-xs">
          {nights}{locale === 'ru' ? 'н.' : 'n.'}
        </Badge>
      )}
    </>
  )
  
  if (isWizardStep) {
    return (
      <div className={className}>
        <WizardCalendarPanel
          dateRange={dateRange}
          onSelect={handleSelect}
          onClear={handleClear}
          locale={locale}
        />
      </div>
    )
  }

  if (useDrawerShell) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={cn(
            "flex w-full min-w-0 items-center gap-3 text-left font-medium transition-colors hover:bg-slate-50/90",
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
  
  if (usePopoverShell) {
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full min-w-0 items-center gap-3 text-left font-medium transition-colors hover:bg-slate-50/90",
            className
          )}
          data-testid="search-calendar-trigger"
        >
          {TriggerContent}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={10}
        collisionPadding={20}
        className="z-[220] w-[min(96vw,900px)] max-h-[calc(100vh-var(--app-header-height,64px)-28px)] overflow-auto rounded-3xl border border-slate-200 bg-white opacity-100 p-0 shadow-2xl"
      >
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

  return (
    <button
      type="button"
      className={cn(
        "flex w-full min-w-0 items-center gap-3 text-left font-medium transition-colors hover:bg-slate-50/90",
        className
      )}
      data-testid="search-calendar-trigger"
    >
      {TriggerContent}
    </button>
  )
}

export default SearchCalendar
