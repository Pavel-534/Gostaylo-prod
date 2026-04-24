'use client'

import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { getUIText } from '@/lib/translations'
import { MARKETING_UI_LANGS } from '@/lib/constants/marketing'
import {
  resolveFlashHotStripState,
  formatFlashRemainingHoursMinutes,
} from '@/lib/listing/flash-hot-strip'

/**
 * Pastel “hot” strip: >6h left + bookings today → fire + count; ≤6h → expiry HH:MM (Stage 39.0).
 */
export function ListingFlashHotStrip({
  catalog_flash_urgency = null,
  catalog_flash_social_proof = null,
  language = 'ru',
  className,
  /** compact text on search cards */
  compact = false,
}) {
  const [tick, setTick] = useState(0)
  const [remoteStrings, setRemoteStrings] = useState(null)

  const apiLang = MARKETING_UI_LANGS.includes(String(language || '').toLowerCase())
    ? String(language).toLowerCase()
    : 'ru'

  useEffect(() => {
    const id = setInterval(() => setTick((x) => x + 1), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/v2/marketing/ui-strings?lang=${encodeURIComponent(apiLang)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.success || !j?.data || typeof j.data !== 'object') return
        setRemoteStrings(j.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [apiLang])

  const state = useMemo(
    () => resolveFlashHotStripState(catalog_flash_urgency, catalog_flash_social_proof, Date.now()),
    [catalog_flash_urgency, catalog_flash_social_proof, tick],
  )

  if (!state) return null

  const textBase = compact ? 'text-[11px] leading-snug' : 'text-sm leading-snug'

  if (state.kind === 'bookings_today') {
    const line = (
      typeof remoteStrings?.flashHotBookingsToday === 'string' && remoteStrings.flashHotBookingsToday.trim()
        ? remoteStrings.flashHotBookingsToday
        : getUIText('listingFlashHot_bookingsToday', language)
    ).replace(/\{\{count\}\}/g, String(state.count))
    return (
      <div
        className={cn(
          'rounded-lg border border-orange-200/90 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50/80 px-3 py-2 shadow-sm',
          className,
        )}
      >
        <p className={cn('font-semibold text-orange-950', textBase)}>
          <span className="mr-1" aria-hidden>
            🔥
          </span>
          {line}
        </p>
      </div>
    )
  }

  const hm = formatFlashRemainingHoursMinutes(state.remainingMs)
  const line = (
    typeof remoteStrings?.flashHotExpiresIn === 'string' && remoteStrings.flashHotExpiresIn.trim()
      ? remoteStrings.flashHotExpiresIn
      : getUIText('listingFlashHot_expiresIn', language)
  ).replace(/\{\{hm\}\}/g, hm)
  return (
    <div
      className={cn(
        'rounded-lg border border-orange-200/90 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50/80 px-3 py-2 shadow-sm',
        className,
      )}
    >
      <p className={cn('font-semibold text-orange-950', textBase)}>
        <span className="mr-1" aria-hidden>
          ⏰
        </span>
        {line}
      </p>
    </div>
  )
}
