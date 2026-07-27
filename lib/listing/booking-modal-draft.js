/**
 * Stage 190.5 / 196.0-B — PDP booking mid-flow draft (form fields + dates/guests).
 * sessionStorage key: `gostaylo_booking_modal_draft`
 */

export const BOOKING_MODAL_DRAFT_KEY = 'gostaylo_booking_modal_draft'

/**
 * @param {object} fields
 * @returns {object}
 */
export function buildBookingModalDraftPayload({
  guestName = '',
  guestEmail = '',
  guestPhone = '',
  message = '',
  guests = 2,
  checkIn = '',
  checkOut = '',
  checkInTime = '',
  checkOutTime = '',
  includeTimes = false,
} = {}) {
  const payload = {
    v: 2,
    guestName: String(guestName ?? ''),
    guestEmail: String(guestEmail ?? ''),
    guestPhone: String(guestPhone ?? ''),
    message: String(message ?? ''),
    guests: Math.max(1, Math.round(Number(guests) || 1)),
  }
  const cin = String(checkIn || '').trim().slice(0, 10)
  const cout = String(checkOut || '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cin)) payload.checkIn = cin
  if (/^\d{4}-\d{2}-\d{2}$/.test(cout)) payload.checkOut = cout
  if (includeTimes) {
    if (/^\d{2}:\d{2}$/.test(String(checkInTime || ''))) payload.checkInTime = String(checkInTime)
    if (/^\d{2}:\d{2}$/.test(String(checkOutTime || ''))) payload.checkOutTime = String(checkOutTime)
  }
  return payload
}

/**
 * @param {unknown} raw
 * @returns {object|null}
 */
export function parseBookingModalDraft(raw) {
  if (raw == null) return null
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Build return href for auth, preferring live date state over lagging URL query.
 * @param {{
 *   pathname?: string|null,
 *   searchParams?: { toString?: () => string, get?: (k: string) => string|null }|null,
 *   checkIn?: string|null,
 *   checkOut?: string|null,
 *   guests?: number|string|null,
 *   checkInTime?: string|null,
 *   checkOutTime?: string|null,
 *   includeTimes?: boolean,
 * }} args
 */
export function buildListingBookingReturnHref({
  pathname,
  searchParams,
  checkIn = '',
  checkOut = '',
  guests = 2,
  checkInTime = '',
  checkOutTime = '',
  includeTimes = false,
} = {}) {
  const basePath = String(pathname || '/').split('?')[0] || '/'
  const p = new URLSearchParams()
  try {
    const existing = searchParams?.toString?.() || ''
    if (existing) {
      const src = new URLSearchParams(existing)
      for (const [k, v] of src.entries()) {
        if (v != null && String(v) !== '') p.set(k, String(v))
      }
    }
  } catch {
    /* ignore */
  }

  const cin = String(checkIn || '').trim().slice(0, 10)
  const cout = String(checkOut || '').trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cin) && /^\d{4}-\d{2}-\d{2}$/.test(cout)) {
    p.set('checkIn', cin)
    p.set('checkOut', cout)
    if (includeTimes) {
      if (/^\d{2}:\d{2}$/.test(String(checkInTime || ''))) p.set('checkInTime', String(checkInTime))
      if (/^\d{2}:\d{2}$/.test(String(checkOutTime || ''))) p.set('checkOutTime', String(checkOutTime))
    }
  }
  p.set('guests', String(Math.max(1, Math.round(Number(guests) || 1))))

  const qs = p.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/**
 * If URL lost dates, return draft dates/guests to re-apply into state (+ later URL sync).
 * @param {{
 *   draft?: object|null,
 *   urlCheckIn?: string|null,
 *   urlCheckOut?: string|null,
 * }} args
 * @returns {{ checkIn?: string, checkOut?: string, guests?: number, checkInTime?: string, checkOutTime?: string }|null}
 */
export function resolveDraftBookingDatesWhenUrlMissing({
  draft,
  urlCheckIn = '',
  urlCheckOut = '',
} = {}) {
  if (!draft || typeof draft !== 'object') return null
  const urlIn = String(urlCheckIn || '').trim()
  const urlOut = String(urlCheckOut || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(urlIn) && /^\d{4}-\d{2}-\d{2}$/.test(urlOut)) {
    return null
  }
  const checkIn = String(draft.checkIn || '').trim().slice(0, 10)
  const checkOut = String(draft.checkOut || '').trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    return null
  }
  if (!(checkOut > checkIn)) return null
  const out = { checkIn, checkOut }
  const g = Math.round(Number(draft.guests))
  if (Number.isFinite(g) && g >= 1) out.guests = g
  if (/^\d{2}:\d{2}$/.test(String(draft.checkInTime || ''))) out.checkInTime = String(draft.checkInTime)
  if (/^\d{2}:\d{2}$/.test(String(draft.checkOutTime || ''))) out.checkOutTime = String(draft.checkOutTime)
  return out
}
