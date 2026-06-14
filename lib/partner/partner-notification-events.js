/**
 * Stage 140.3 — SSOT partner notification events (feed + foreground toasts).
 * Maps DB rows / push types → UI items without backend jargon.
 */

import { getUIText } from '@/lib/translations'

export const PARTNER_NOTIF_KIND = Object.freeze({
  NEW_BOOKING: 'new_booking',
  PAYMENT_RECEIVED: 'payment_received',
  WALLET_CREDIT: 'wallet_credit',
  BOOKING_UPDATED: 'booking_updated',
})

const PENDING_STATUSES = new Set(['PENDING', 'INQUIRY', 'AWAITING_PAYMENT'])
const PAID_STATUSES = new Set(['PAID', 'PAID_ESCROW', 'CHECKED_IN'])

/**
 * @param {string} bookingId
 * @returns {string}
 */
export function partnerBookingHref(bookingId) {
  if (!bookingId) return '/partner/bookings'
  return `/partner/bookings?booking=${encodeURIComponent(String(bookingId))}`
}

/**
 * @param {object} row — bookings row from Realtime or API
 * @param {{ event?: 'INSERT'|'UPDATE', previousStatus?: string, language?: string }} [ctx]
 * @returns {import('./partner-notification-events').PartnerNotificationItem | null}
 */
export function mapBookingRowToNotification(row, ctx = {}) {
  if (!row?.id) return null
  const status = String(row.status || '').toUpperCase()
  const prev = String(ctx.previousStatus || '').toUpperCase()
  const language = ctx.language || 'ru'
  const bookingId = String(row.id)
  const listingTitle =
    row.listing?.title || row.listing_title || row.metadata?.listing_title || ''
  const guestName = row.guest_name || row.guestName || ''
  const now = row.updated_at || row.created_at || new Date().toISOString()

  if (ctx.event === 'INSERT' && PENDING_STATUSES.has(status)) {
    return buildItem({
      kind: PARTNER_NOTIF_KIND.NEW_BOOKING,
      bookingId,
      createdAt: now,
      title: getUIText('partnerNotif_newBookingTitle', language),
      body: getUIText('partnerNotif_newBookingBody', language)
        .replace('{listing}', listingTitle || '—')
        .replace('{guest}', guestName || '—'),
      href: partnerBookingHref(bookingId),
      meta: { listingTitle, guestName, status },
    })
  }

  if (
    PAID_STATUSES.has(status) &&
    ctx.event === 'UPDATE' &&
    prev &&
    !PAID_STATUSES.has(prev)
  ) {
    const amount = row.price_thb ?? row.partner_earnings_thb ?? ''
    return buildItem({
      kind: PARTNER_NOTIF_KIND.PAYMENT_RECEIVED,
      bookingId,
      createdAt: now,
      title: getUIText('partnerNotif_paymentTitle', language),
      body: getUIText('partnerNotif_paymentBody', language)
        .replace('{amount}', amount ? String(amount) : '—')
        .replace('{listing}', listingTitle || '—'),
      href: partnerBookingHref(bookingId),
      meta: { listingTitle, amount, status },
    })
  }

  if (ctx.event === 'UPDATE' && status !== prev && status) {
    return buildItem({
      kind: PARTNER_NOTIF_KIND.BOOKING_UPDATED,
      bookingId,
      createdAt: now,
      title: getUIText('partnerNotif_statusTitle', language),
      body: getUIText('partnerNotif_statusBody', language)
        .replace('{listing}', listingTitle || '—')
        .replace('{status}', status),
      href: partnerBookingHref(bookingId),
      meta: { listingTitle, status },
    })
  }

  return null
}

/**
 * @param {object} row — wallet_transactions row
 * @param {{ language?: string }} [ctx]
 */
export function mapWalletRowToNotification(row, ctx = {}) {
  if (!row?.id || String(row.operation_type || '').toLowerCase() !== 'credit') return null
  const language = ctx.language || 'ru'
  const amount = row.amount_thb ?? ''
  return buildItem({
    kind: PARTNER_NOTIF_KIND.WALLET_CREDIT,
    bookingId: row.reference_id || row.id,
    createdAt: row.created_at || new Date().toISOString(),
    title: getUIText('partnerNotif_walletTitle', language),
    body: getUIText('partnerNotif_walletBody', language).replace('{amount}', String(amount)),
    href: '/profile/referral',
    meta: { amount, txType: row.tx_type },
  })
}

/**
 * Map FCM foreground payload → notification item.
 * @param {Record<string, string>} data
 * @param {string} [language]
 */
export function mapPushPayloadToNotification(data, language = 'ru') {
  if (!data || typeof data !== 'object') return null
  const type = String(data.type || data.templateKey || '').toUpperCase()
  const bookingId = data.bookingId || data.booking_id || ''
  const listing = data.listing || ''
  const amount = data.amount || ''
  const dates = data.dates || ''
  const link = data.link || (bookingId ? partnerBookingHref(bookingId) : '/partner/bookings')

  if (type === 'BOOKING_REQUEST' || type === 'BOOKING_INSTANT_PARTNER' || type === 'NEW_BOOKING_REQUEST') {
    return buildItem({
      kind: PARTNER_NOTIF_KIND.NEW_BOOKING,
      bookingId,
      createdAt: new Date().toISOString(),
      title: getUIText('partnerNotif_newBookingTitle', language),
      body: getUIText('partnerNotif_newBookingBody', language)
        .replace('{listing}', listing || '—')
        .replace('{guest}', dates || '—'),
      href: link.startsWith('http') ? link.replace(/^https?:\/\/[^/]+/, '') : link,
      meta: { listing, dates },
    })
  }

  if (type === 'PAYMENT_RECEIVED' || type === 'PAYMENT_CONFIRMED') {
    return buildItem({
      kind: PARTNER_NOTIF_KIND.PAYMENT_RECEIVED,
      bookingId,
      createdAt: new Date().toISOString(),
      title: getUIText('partnerNotif_paymentTitle', language),
      body: getUIText('partnerNotif_paymentBody', language)
        .replace('{amount}', amount || '—')
        .replace('{listing}', listing || '—'),
      href: link.startsWith('http') ? link.replace(/^https?:\/\/[^/]+/, '') : link,
      meta: { listing, amount },
    })
  }

  if (type === 'FUNDS_THAWED_PARTNER') {
    return buildItem({
      kind: PARTNER_NOTIF_KIND.PAYMENT_RECEIVED,
      bookingId,
      createdAt: new Date().toISOString(),
      title: getUIText('partnerNotif_fundsThawedTitle', language),
      body: getUIText('partnerNotif_fundsThawedBody', language).replace('{amount}', amount || '—'),
      href: '/partner/finances',
      meta: { amount, listing },
    })
  }

  return null
}

/**
 * @param {{ kind: string, bookingId?: string, createdAt: string, title: string, body: string, href: string, meta?: object }} params
 */
function buildItem({ kind, bookingId, createdAt, title, body, href, meta }) {
  const ts = new Date(createdAt).getTime()
  const id = `${kind}:${bookingId || 'na'}:${Number.isFinite(ts) ? ts : Date.now()}`
  return {
    id,
    kind,
    title,
    body,
    href,
    createdAt,
    read: false,
    meta: meta || {},
  }
}

/**
 * Dedupe notifications by kind + booking reference.
 * @param {Array<{ id: string, kind: string, meta?: object }>} items
 * @param {{ id: string, kind: string }} candidate
 */
export function isDuplicateNotification(items, candidate) {
  const bid =
    candidate.meta?.bookingId ||
    (candidate.id && String(candidate.id).split(':')[1]) ||
    ''
  if (!bid || bid === 'na') return false
  return items.some(
    (it) =>
      it.kind === candidate.kind &&
      (it.meta?.bookingId === bid || String(it.id).includes(`:${bid}:`)),
  )
}
