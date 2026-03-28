/**
 * Deep link на поиск «Транспорт» с районом и датами из брони.
 * В URL: category=transport (алиас к slug БД `vehicles`, см. run-listings-search-get + listings page).
 */
import { format, isValid, parseISO } from 'date-fns'

function toYmd(value) {
  if (value == null || value === '') return null
  if (typeof value === 'string') {
    const s = value.slice(0, 10)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    const d = parseISO(value)
    return isValid(d) ? format(d, 'yyyy-MM-dd') : null
  }
  const d = value instanceof Date ? value : new Date(value)
  return isValid(d) ? format(d, 'yyyy-MM-dd') : null
}

export function buildTransportListingsUrl({ listing, booking } = {}) {
  const params = new URLSearchParams()
  params.set('category', 'transport')

  const district =
    (listing?.district && String(listing.district).trim()) ||
    (booking?.listings?.district && String(booking.listings.district).trim()) ||
    ''

  if (district) params.set('where', district)
  else params.set('where', 'Phuket')

  const checkIn = toYmd(booking?.check_in ?? booking?.checkIn)
  const checkOut = toYmd(booking?.check_out ?? booking?.checkOut)
  if (checkIn) params.set('checkIn', checkIn)
  if (checkOut) params.set('checkOut', checkOut)

  return `/listings?${params.toString()}`
}
