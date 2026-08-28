/**
 * Stage 202.16 — resolve guest payment capture timestamp for cancel grace window.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { resolvePaymentCapturedAtFromIntent } from '@/lib/cancellation-refund-rules.js'

/**
 * Latest PAID intent capture time for a booking (confirmed_at → metadata.paid_event.at).
 * @param {string} bookingId
 * @returns {Promise<Date | null>}
 */
export async function resolveLatestPaymentCapturedAtForBooking(bookingId) {
  if (!bookingId || !supabaseAdmin) return null

  const { data, error } = await supabaseAdmin
    .from('payment_intents')
    .select('confirmed_at, status, metadata')
    .eq('booking_id', String(bookingId))
    .eq('status', 'PAID')
    .order('confirmed_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return resolvePaymentCapturedAtFromIntent(data)
}
