import { GUEST_VIEWED_COOKIE_NAME } from '@/lib/guest/constants.js'
import { parseGuestViewedCookie } from '@/lib/guest/guest-signals.js'

/**
 * @param {import('next/dist/servers/request/cookies').ReadonlyRequestCookies} cookieStore
 */
export function readGuestViewedFromNextCookies(cookieStore) {
  const raw = cookieStore?.get?.(GUEST_VIEWED_COOKIE_NAME)?.value ?? null
  return parseGuestViewedCookie(raw)
}
