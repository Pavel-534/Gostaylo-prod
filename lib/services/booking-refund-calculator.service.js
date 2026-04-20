/**
 * PR-#5: Guest refund estimate from listing cancellation policy + captured guest total (ledger basis).
 */

import { supabaseAdmin } from '@/lib/supabase';
import { computeBookingPaymentLedgerLegs } from '@/lib/services/ledger.service';
import { computeRefundGuestThbFromCancellation } from '@/lib/cancellation-refund-rules';

/**
 * @param {string} bookingId
 * @param {Date} [cancelledAt]
 * @returns {Promise<
 *   | { ok: true; bookingId: string; refundGuestThb: number; percent: number; hoursBefore: number; policy: string; guestTotalThb: number; listingId: string | null }
 *   | { ok: false; error: string }
 * >}
 */
export async function computeRefundEstimateForBooking(bookingId, cancelledAt = new Date()) {
  if (!bookingId) {
    return { ok: false, error: 'booking_id_required' };
  }

  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select(
      `
      id,
      listing_id,
      check_in,
      price_thb,
      commission_thb,
      rounding_diff_pot,
      partner_earnings_thb,
      commission_rate,
      price_paid,
      exchange_rate,
      pricing_snapshot,
      listings ( id, cancellation_policy )
    `,
    )
    .eq('id', bookingId)
    .maybeSingle();

  if (error || !booking) {
    return { ok: false, error: 'booking_not_found' };
  }

  const listing = booking.listings;
  const listingRow = Array.isArray(listing) ? listing[0] : listing;

  const legs = computeBookingPaymentLedgerLegs(booking);
  const guestTotalThb = legs.guestTotalThb;

  const { refundGuestThb, percent, hoursBefore, policy } = computeRefundGuestThbFromCancellation(
    { cancellation_policy: listingRow?.cancellation_policy },
    booking.check_in,
    guestTotalThb,
    cancelledAt,
  );

  return {
    ok: true,
    bookingId: booking.id,
    listingId: booking.listing_id ?? null,
    refundGuestThb,
    percent,
    hoursBefore,
    policy,
    guestTotalThb,
  };
}
