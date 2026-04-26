/**
 * Partner review invite after checkout (Stage 47.2).
 * Отделено от разморозки эскроу: FCM/Telegram только когда календарная дата check_out прошла.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { listingDateToday, toListingDate } from '@/lib/listing-date'
import { NotificationService, NotificationEvents } from './notification.service.js'
import { resolveListingCategorySlug } from '@/lib/services/booking.service'
import { BookingStatus } from '@/lib/services/escrow/constants.js'

const INVITE_META_KEY = 'partner_client_review_invite_at'

function ymdCompare(a, b) {
  if (!a || !b) return 0
  return a < b ? -1 : a > b ? 1 : 0
}

/**
 * @param {{ limit?: number }} opts
 * @returns {Promise<{ processed: number, skipped: number, errors: string[] }>}
 */
export async function processPartnerClientReviewInvitesDue(opts = {}) {
  const limit = Math.min(200, Math.max(1, Number(opts.limit) || 80))
  const todayYmd = listingDateToday()
  const errors = []
  let processed = 0
  let skipped = 0

  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      id,
      partner_id,
      renter_id,
      guest_name,
      check_out,
      status,
      metadata,
      listing:listings(id, title, category_id)
    `,
    )
    .in('status', [BookingStatus.THAWED, BookingStatus.COMPLETED])
    .not('partner_id', 'is', null)
    .not('check_out', 'is', null)
    .limit(limit * 4)

  if (error) {
    return { processed: 0, skipped: 0, errors: [error.message] }
  }

  const candidates = (rows || []).filter((b) => {
    const meta = b.metadata && typeof b.metadata === 'object' ? b.metadata : {}
    if (meta[INVITE_META_KEY]) return false
    const co = toListingDate(b.check_out)
    if (!co) return false
    return ymdCompare(todayYmd, co) > 0
  })

  const slice = candidates.slice(0, limit)
  if (slice.length === 0) {
    return { processed: 0, skipped: 0, errors }
  }

  const bookingIds = slice.map((b) => b.id)
  const { data: reviews } = await supabaseAdmin
    .from('guest_reviews')
    .select('booking_id')
    .in('booking_id', bookingIds)

  const reviewed = new Set((reviews || []).map((r) => r.booking_id))

  for (const booking of slice) {
    if (reviewed.has(booking.id)) {
      skipped += 1
      continue
    }
    try {
      const [partnerRes, renterRes] = await Promise.all([
        supabaseAdmin
          .from('profiles')
          .select('id, telegram_id, language, first_name, email')
          .eq('id', booking.partner_id)
          .maybeSingle(),
        supabaseAdmin
          .from('profiles')
          .select('id, first_name, last_name, email')
          .eq('id', booking.renter_id)
          .maybeSingle(),
      ])
      const partner = partnerRes.data
      if (!partner?.id) {
        skipped += 1
        continue
      }
      let categorySlug =
        (booking.metadata && booking.metadata.listing_category_slug) || null
      if (!categorySlug && booking.listing?.category_id) {
        categorySlug = await resolveListingCategorySlug(booking.listing.category_id)
      }

      await NotificationService.dispatch(NotificationEvents.PARTNER_GUEST_REVIEW_INVITE, {
        booking: { ...booking, listing: booking.listing },
        listing: booking.listing,
        partner,
        renter: renterRes.data,
        categorySlug,
      })

      const meta = booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
      const nextMeta = { ...meta, [INVITE_META_KEY]: new Date().toISOString() }
      const { error: upErr } = await supabaseAdmin
        .from('bookings')
        .update({ metadata: nextMeta })
        .eq('id', booking.id)
      if (upErr) {
        errors.push(`${booking.id}: ${upErr.message}`)
        continue
      }
      processed += 1
    } catch (e) {
      errors.push(`${booking.id}: ${e?.message || e}`)
    }
  }

  return { processed, skipped, errors }
}
