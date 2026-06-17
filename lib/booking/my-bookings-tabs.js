import { parseISO, isPast, isFuture } from 'date-fns'

const UPCOMING_STATUSES = [
  'PENDING',
  'INQUIRY',
  'CONFIRMED',
  'AWAITING_PAYMENT',
  'PAID',
  'PAID_ESCROW',
  'CHECKED_IN',
  'THAWED',
]

const CANCELLED_STATUSES = ['CANCELLED', 'DECLINED']

/** Вкладка списка, где видна бронь (для ?booking= из Telegram / push). */
export function tabForBookingDeepLink(booking) {
  if (!booking) return 'all'
  const status = String(booking.status || '').toUpperCase()
  if (CANCELLED_STATUSES.includes(status)) return 'cancelled'
  const checkOut = booking.check_out ? parseISO(booking.check_out) : null
  if ((checkOut && isPast(checkOut)) || status === 'COMPLETED') return 'past'
  const checkIn = booking.check_in ? parseISO(booking.check_in) : null
  if (UPCOMING_STATUSES.includes(status)) {
    if (status === 'PENDING' || status === 'INQUIRY') {
      return !checkOut || !isPast(checkOut) ? 'upcoming' : 'all'
    }
    if (checkIn && isFuture(checkIn)) return 'upcoming'
  }
  return 'all'
}

function isUpcomingBooking(booking) {
  const status = String(booking?.status || '').toUpperCase()
  if (!UPCOMING_STATUSES.includes(status)) return false
  const checkIn = booking?.check_in ? parseISO(booking.check_in) : null
  const checkOut = booking?.check_out ? parseISO(booking.check_out) : null
  if (status === 'PENDING' || status === 'INQUIRY') {
    return !checkOut || !isPast(checkOut)
  }
  return !!checkIn && isFuture(checkIn)
}

function isPastBooking(booking) {
  const checkOut = booking?.check_out ? parseISO(booking.check_out) : null
  return (
    (checkOut && isPast(checkOut)) ||
    String(booking?.status || '').toUpperCase() === 'COMPLETED'
  )
}

function isCancelledBooking(booking) {
  return CANCELLED_STATUSES.includes(String(booking?.status || '').toUpperCase())
}

/** Фильтр по вкладке статуса (all / upcoming / past / cancelled). */
export function filterBookingsByStatusTab(bookings, tab) {
  const list = Array.isArray(bookings) ? bookings : []
  if (tab === 'all') return list
  if (tab === 'upcoming') return list.filter(isUpcomingBooking)
  if (tab === 'past') return list.filter(isPastBooking)
  if (tab === 'cancelled') return list.filter(isCancelledBooking)
  return list
}

/** Счётчики для бейджей вкладок. */
export function countBookingsByStatusTab(bookings) {
  const list = Array.isArray(bookings) ? bookings : []
  return {
    all: list.length,
    upcoming: list.filter(isUpcomingBooking).length,
    past: list.filter(isPastBooking).length,
    cancelled: list.filter(isCancelledBooking).length,
  }
}
