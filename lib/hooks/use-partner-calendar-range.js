/**
 * Two-tap date range selection for partner master calendar (Stage 188.0 Iteration 3).
 */

'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { getUIText } from '@/lib/translations'
import {
  compareCalendarDates,
  validateAvailableDateRange,
  resolveCalendarRangeCellRole,
} from '@/lib/calendar/partner-calendar-range-utils.js'

const RANGE_HINT_TOAST_ID = 'partner-cal-range-hint'

/**
 * @param {{ language?: string }} options
 */
export function usePartnerCalendarRangeSelection({ language = 'ru' } = {}) {
  const [rangeSelection, setRangeSelection] = useState(null)

  const t = useCallback((key) => getUIText(key, language), [language])

  const clearRangeSelection = useCallback(() => {
    setRangeSelection(null)
    toast.dismiss(RANGE_HINT_TOAST_ID)
  }, [])

  const getCellRangeRole = useCallback(
    (listingId, date) =>
      resolveCalendarRangeCellRole({
        listingId,
        date,
        rangeSelection,
      }),
    [rangeSelection],
  )

  /**
   * @param {object} listing
   * @param {string} date YYYY-MM-DD
   * @param {Record<string, { status?: string }>|undefined} availability
   * @returns {{
   *   action: 'pending' | 'cleared' | 'open-modal' | 'restarted',
   *   listing?: object,
   *   rangeStart?: string,
   *   rangeEnd?: string,
   * }}
   */
  const processAvailableCellTap = useCallback(
    (listing, date, availability) => {
      const listingId = listing?.id
      if (!listingId || !date) {
        return { action: 'cleared' }
      }

      const current = rangeSelection

      if (!current || current.listingId !== listingId) {
        setRangeSelection({ listingId, listing, start: date, end: null })
        toast.message(t('partnerCal_rangeSelectEnd'), { id: RANGE_HINT_TOAST_ID, duration: 4000 })
        return { action: 'pending' }
      }

      if (!current.end && current.start === date) {
        clearRangeSelection()
        return { action: 'cleared' }
      }

      if (!current.end) {
        const cmp = compareCalendarDates(date, current.start)

        if (cmp <= 0) {
          setRangeSelection({ listingId, listing, start: date, end: null })
          toast.message(t('partnerCal_rangeSelectEnd'), { id: RANGE_HINT_TOAST_ID, duration: 4000 })
          return { action: 'restarted' }
        }

        const validation = validateAvailableDateRange(availability, current.start, date)
        if (!validation.valid) {
          toast.warning(t('partnerCal_rangeInvalidBooked'))
          setRangeSelection({ listingId, listing, start: date, end: null })
          toast.message(t('partnerCal_rangeSelectEnd'), { id: RANGE_HINT_TOAST_ID, duration: 4000 })
          return { action: 'restarted' }
        }

        toast.dismiss(RANGE_HINT_TOAST_ID)
        toast.success(t('partnerCal_rangeSelected'), { duration: 2500 })

        const result = {
          action: 'open-modal',
          listing,
          rangeStart: current.start,
          rangeEnd: date,
        }
        setRangeSelection(null)
        return result
      }

      setRangeSelection({ listingId, listing, start: date, end: null })
      toast.message(t('partnerCal_rangeSelectEnd'), { id: RANGE_HINT_TOAST_ID, duration: 4000 })
      return { action: 'pending' }
    },
    [rangeSelection, clearRangeSelection, t],
  )

  return {
    rangeSelection,
    clearRangeSelection,
    getCellRangeRole,
    processAvailableCellTap,
  }
}
