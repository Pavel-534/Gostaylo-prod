/**
 * Partner-facing booking DTO (camelCase) — shared by list and detail APIs (Stage 46.0).
 */

import { toPublicImageUrl, mapPublicImageUrls } from '@/lib/public-image-url'
import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total.js'

/**
 * @param {object} booking — raw Supabase row (snake_case) + nested listing/renter
 * @param {number} defaultCommissionPercent
 */
export function transformPartnerBookingToClient(booking, defaultCommissionPercent) {
  const dc = defaultCommissionPercent
  return {
    id: booking.id,
    listingId: booking.listing_id,
    renterId: booking.renter_id,
    partnerId: booking.partner_id,
    status: booking.status,
    checkIn: booking.check_in,
    checkOut: booking.check_out,
    priceThb: parseFloat(booking.price_thb) || 0,
    guestPayableThb: getGuestPayableRoundedThb(booking),
    commissionRate: (() => {
      const n = parseFloat(booking.commission_rate)
      return Number.isFinite(n) && n >= 0 ? n : dc
    })(),
    commissionThb: parseFloat(booking.commission_thb) || 0,
    partnerEarningsThb: parseFloat(booking.partner_earnings_thb) || 0,
    taxableMarginAmount: parseFloat(booking.taxable_margin_amount) || 0,
    roundingDiffPot: parseFloat(booking.rounding_diff_pot) || 0,
    guestName: booking.guest_name,
    guestPhone: booking.guest_phone,
    guestEmail: booking.guest_email,
    specialRequests: booking.special_requests,
    confirmedAt: booking.confirmed_at,
    cancelledAt: booking.cancelled_at,
    completedAt: booking.completed_at,
    createdAt: booking.created_at,
    updatedAt: booking.updated_at,
    pricing_snapshot: booking.pricing_snapshot,
    metadata: booking.metadata,
    listing: booking.listing
      ? (() => {
          const L = booking.listing
          const cat = L.categories
          const c0 = Array.isArray(cat) ? cat[0] : cat
          const slug = String(c0?.slug || '').toLowerCase()
          const meta =
            L.metadata && typeof L.metadata === 'object' && !Array.isArray(L.metadata) ? L.metadata : {}
          return {
            id: L.id,
            title: L.title,
            district: L.district,
            images: mapPublicImageUrls(L.images || []),
            coverImage: L.cover_image ? toPublicImageUrl(L.cover_image) : null,
            basePriceThb: parseFloat(L.base_price_thb) || 0,
            commissionRate: (() => {
              const n = parseFloat(L.commission_rate)
              return Number.isFinite(n) && n >= 0 ? n : dc
            })(),
            metadata: meta,
            category_slug: slug,
          }
        })()
      : null,
    renter: booking.renter
      ? {
          id: booking.renter.id,
          firstName: booking.renter.first_name,
          lastName: booking.renter.last_name,
          email: booking.renter.email,
        }
      : null,
  }
}
