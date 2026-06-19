'use client'

/**
 * Browser cookie read/write for guest viewed listings (Stage 169.5).
 */

import {
  GUEST_VIEWED_COOKIE_NAME,
  GUEST_VIEWED_TTL_DAYS,
} from '@/lib/guest/constants.js'
import {
  parseGuestViewedCookie,
  serializeGuestViewedCookie,
  upsertGuestViewedItem,
} from '@/lib/guest/guest-signals.js'

function readRawCookie() {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${GUEST_VIEWED_COOKIE_NAME}=([^;]*)`),
  )
  return match?.[1] ?? ''
}

/**
 * @returns {import('@/lib/guest/guest-signals.js').GuestViewedItem[]}
 */
export function readGuestViewedItemsClient() {
  return parseGuestViewedCookie(readRawCookie())
}

/**
 * @returns {string[]}
 */
export function readGuestViewedListingIdsClient() {
  return readGuestViewedItemsClient().map((row) => row.id)
}

/**
 * @param {string} listingId
 */
export function recordGuestListingViewClient(listingId) {
  if (typeof document === 'undefined') return
  const id = String(listingId || '').trim()
  if (!id) return

  const items = upsertGuestViewedItem(readGuestViewedItemsClient(), id)
  const value = serializeGuestViewedCookie(items)
  const maxAge = GUEST_VIEWED_TTL_DAYS * 24 * 60 * 60
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${GUEST_VIEWED_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`
}
