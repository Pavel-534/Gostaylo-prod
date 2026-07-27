/**
 * Stage 196.0-A — Day-of CheckIn Access Pack eligibility + payload SSOT.
 */

import { CONTACT_REVEALED_BOOKING_STATUSES } from '@/lib/booking/status-sets'
import { listingDateToday, toListingDate } from '@/lib/listing-date'
import {
  formatGuestOrderLocationFromListing,
  resolveGuestExactAddress,
} from '@/lib/orders/format-guest-order-location'
import {
  normalizeOrderStatus,
  shouldAllowCheckInToday,
} from '@/lib/orders/order-timeline'

function trimStr(v) {
  if (v == null) return ''
  return String(v).trim()
}

function readBookingMetadata(booking) {
  const m = booking?.metadata
  return m && typeof m === 'object' && !Array.isArray(m) ? m : {}
}

function isCheckInCalendarDay(checkInIso, now = new Date()) {
  const checkInYmd = toListingDate(checkInIso)
  const todayYmd = toListingDate(now) || listingDateToday()
  if (!checkInYmd || !todayYmd) return false
  return checkInYmd === todayYmd
}

/**
 * Active fulfillment window: paid escrow / checked-in / paid, or check-in calendar day while paid-revealed.
 * @param {string|null|undefined} status
 * @param {string|null|undefined} checkInIso
 * @param {Date} [now]
 */
export function shouldShowCheckInAccessPack(status, checkInIso, now = new Date()) {
  const st = normalizeOrderStatus(status)
  if (st === 'PAID_ESCROW' || st === 'CHECKED_IN' || st === 'PAID') return true
  if (shouldAllowCheckInToday(st, checkInIso, now)) return true
  if (CONTACT_REVEALED_BOOKING_STATUSES.has(st) && isCheckInCalendarDay(checkInIso, now)) return true
  return false
}

/**
 * @param {object} opts
 * @param {object} opts.booking
 * @param {object|null|undefined} opts.listing
 * @param {string} opts.status
 * @param {string|null|undefined} opts.checkInIso
 * @param {string} [opts.language='ru']
 * @param {string|null} [opts.chatHref]
 * @param {string} [opts.instructionsText]
 * @param {string[]} [opts.photoUrls]
 */
export function buildCheckInAccessPackModel({
  booking,
  listing,
  status,
  checkInIso,
  language = 'ru',
  chatHref = null,
  instructionsText = '',
  photoUrls = [],
}) {
  const visible = shouldShowCheckInAccessPack(status, checkInIso)
  if (!visible) {
    return {
      visible: false,
      exactAddress: '',
      locationLabel: '',
      accessCode: '',
      instructionsText: '',
      photoUrls: [],
      chatHref: null,
    }
  }

  const meta = readBookingMetadata(booking)
  const accessCode = trimStr(
    meta.access_code || meta.accessCode || meta.door_code || meta.doorCode || meta.pin_code || meta.pinCode,
  )
  const exactAddress = resolveGuestExactAddress(listing, status)
  const locationLabel = formatGuestOrderLocationFromListing(listing, language)
  const instructions = trimStr(instructionsText) || trimStr(meta.check_in_instructions)
  const photos = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : []

  return {
    visible: true,
    exactAddress,
    locationLabel,
    accessCode,
    instructionsText: instructions,
    photoUrls: photos,
    chatHref: chatHref || null,
  }
}
