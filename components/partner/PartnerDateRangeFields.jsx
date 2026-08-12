'use client'

/**
 * PartnerDateRangeFields — SSOT start/end date pickers for partner wizard & hub.
 * Stage 200.117 Wave B / 200.120 Wave E: Popover + ui/calendar; optional lockStart for master calendar.
 * Do not use for storefront SearchCalendar / PlatformCalendar (guest booking).
 */

import { useState } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { resolvePartnerDateFnsLocale } from '@/lib/ui/partner-date-fns-locale'

export {
  parsePartnerYmd,
  formatPartnerYmd,
} from '@/lib/ui/partner-date-ymd'

/** Above Dialog/Drawer overlays (z-[220]); match ActionModals SelectContent. */
export const PARTNER_DATE_POPOVER_IN_OVERLAY_CLASS = 'z-[400]'

/**
 * @param {{
 *   startDate: Date | null,
 *   endDate: Date | null,
 *   onChange: (next: { startDate: Date | null, endDate: Date | null }) => void,
 *   startLabel?: string,
 *   endLabel?: string,
 *   placeholder?: string,
 *   disablePast?: boolean,
 *   disabledDates?: Date[],
 *   requireStartBeforeEnd?: boolean,
 *   autoOpenEnd?: boolean,
 *   endRequiresStart?: boolean,
 *   lockStart?: boolean,
 *   popoverContentClassName?: string,
 *   className?: string,
 *   startTestId?: string,
 *   endTestId?: string,
 * }} props
 */
export function PartnerDateRangeFields({
  startDate,
  endDate,
  onChange,
  startLabel,
  endLabel,
  placeholder,
  disablePast = false,
  disabledDates = [],
  requireStartBeforeEnd = true,
  autoOpenEnd = true,
  endRequiresStart = true,
  lockStart = false,
  popoverContentClassName,
  className,
  startTestId = 'partner-date-range-start',
  endTestId = 'partner-date-range-end',
}) {
  const { language } = useI18n()
  const dateLocale = resolvePartnerDateFnsLocale(language)
  const [startOpen, setStartOpen] = useState(false)
  const [endOpen, setEndOpen] = useState(false)

  const labelStart = startLabel || getUIText('partnerCal_periodStart', language)
  const labelEnd = endLabel || getUIText('partnerCal_periodEnd', language)
  const pickPlaceholder = placeholder || getUIText('partnerCal_pickDate', language)

  const isDisabledDay = (date, { boundStart = false } = {}) => {
    if (disablePast) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (date < today) return true
    }
    if (boundStart && startDate && requireStartBeforeEnd && date < startDate) return true
    return disabledDates.some((d) => d.toDateString() === date.toDateString())
  }

  const startTrigger = (
    <Button
      type="button"
      variant="outline"
      className="min-h-[44px] w-full justify-start text-left font-normal"
      disabled={lockStart}
      data-testid={startTestId}
    >
      <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
      {startDate ? format(startDate, 'd MMM yyyy', { locale: dateLocale }) : pickPlaceholder}
    </Button>
  )

  return (
    <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2', className)}>
      <div className="space-y-2">
        <Label>{labelStart}</Label>
        {lockStart ? (
          startTrigger
        ) : (
          <Popover open={startOpen} onOpenChange={setStartOpen}>
            <PopoverTrigger asChild>{startTrigger}</PopoverTrigger>
            <PopoverContent
              className={cn('w-auto p-0', popoverContentClassName)}
              align="start"
            >
              <Calendar
                mode="single"
                locale={dateLocale}
                selected={startDate || undefined}
                onSelect={(date) => {
                  if (!date) return
                  const nextEnd = endDate && date > endDate ? date : endDate
                  onChange({ startDate: date, endDate: nextEnd })
                  setStartOpen(false)
                  if (autoOpenEnd) setEndOpen(true)
                }}
                disabled={(date) => isDisabledDay(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        )}
      </div>

      <div className="space-y-2">
        <Label>{labelEnd}</Label>
        <Popover open={endOpen} onOpenChange={setEndOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full justify-start text-left font-normal"
              disabled={endRequiresStart && !startDate}
              data-testid={endTestId}
            >
              <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
              {endDate
                ? format(endDate, 'd MMM yyyy', { locale: dateLocale })
                : pickPlaceholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className={cn('w-auto p-0', popoverContentClassName)}
            align="start"
          >
            <Calendar
              mode="single"
              locale={dateLocale}
              selected={endDate || undefined}
              onSelect={(date) => {
                if (!date) return
                onChange({ startDate, endDate: date })
                setEndOpen(false)
              }}
              disabled={(date) => isDisabledDay(date, { boundStart: true })}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}

export default PartnerDateRangeFields
