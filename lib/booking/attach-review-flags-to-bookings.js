/**
 * Stage 147 — SSOT: review submission flags on booking rows (chat enrich + action bar).
 *
 * Renter → `reviews` (one per booking).
 * Partner → `guest_reviews` (author_id = partner_id).
 */

import { PARTNER_GUEST_REVIEW_INVITE_STATUSES } from '@/lib/booking/status-sets.js'

const PARTNER_REVIEW_STATUSES = new Set(PARTNER_GUEST_REVIEW_INVITE_STATUSES)

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} admin
 * @param {object[]} bookings
 * @param {{ viewerUserId?: string }} [opts]
 */
export async function attachReviewFlagsToBookings(admin, bookings, opts = {}) {
  if (!Array.isArray(bookings) || bookings.length === 0) return bookings || []
  if (!admin) return bookings

  const ids = [...new Set(bookings.map((b) => String(b?.id || '')).filter(Boolean))]
  if (!ids.length) return bookings

  const [renterReviewsRes, guestReviewsRes] = await Promise.all([
    admin.from('reviews').select('booking_id, user_id').in('booking_id', ids),
    admin.from('guest_reviews').select('booking_id, author_id').in('booking_id', ids),
  ])

  if (renterReviewsRes.error) {
    console.warn('[attachReviewFlagsToBookings] reviews', renterReviewsRes.error.message)
  }
  if (guestReviewsRes.error) {
    console.warn('[attachReviewFlagsToBookings] guest_reviews', guestReviewsRes.error.message)
  }

  /** booking_id → Set<user_id> */
  const renterReviewByBooking = new Map()
  for (const row of renterReviewsRes.data || []) {
    const bid = String(row.booking_id || '')
    if (!bid) continue
    if (!renterReviewByBooking.has(bid)) renterReviewByBooking.set(bid, new Set())
    renterReviewByBooking.get(bid).add(String(row.user_id || ''))
  }

  /** booking_id → Set<author_id> */
  const partnerReviewByBooking = new Map()
  for (const row of guestReviewsRes.data || []) {
    const bid = String(row.booking_id || '')
    if (!bid) continue
    if (!partnerReviewByBooking.has(bid)) partnerReviewByBooking.set(bid, new Set())
    partnerReviewByBooking.get(bid).add(String(row.author_id || ''))
  }

  const viewerUid = opts.viewerUserId ? String(opts.viewerUserId) : null

  return bookings.map((b) => {
    const bid = String(b?.id || '')
    const renterId = String(b?.renter_id || b?.renterId || '')
    const partnerId = String(b?.partner_id || b?.partnerId || '')
    const status = String(b?.status || '').toUpperCase()

    const renterReviewed = renterReviewByBooking.get(bid)?.has(renterId) ?? false
    const partnerReviewed = partnerReviewByBooking.get(bid)?.has(partnerId) ?? false

    const canSubmitRenterReview = status === 'COMPLETED' && !!renterId && !renterReviewed
    const canSubmitPartnerGuestReview =
      PARTNER_REVIEW_STATUSES.has(status) && !!partnerId && !!renterId && !partnerReviewed

    const isViewerRenter = viewerUid && renterId && viewerUid === renterId
    const isViewerPartner = viewerUid && partnerId && viewerUid === partnerId

    return {
      ...b,
      renter_has_review: renterReviewed,
      renterHasReview: renterReviewed,
      partner_has_review: partnerReviewed,
      partnerHasReview: partnerReviewed,
      has_review: isViewerRenter ? renterReviewed : isViewerPartner ? partnerReviewed : false,
      hasReview: isViewerRenter ? renterReviewed : isViewerPartner ? partnerReviewed : false,
      can_submit_renter_review: canSubmitRenterReview,
      canSubmitRenterReview,
      can_submit_partner_guest_review: canSubmitPartnerGuestReview,
      canSubmitPartnerGuestReview,
    }
  })
}
