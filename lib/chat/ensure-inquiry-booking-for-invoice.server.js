/**
 * Stage 172.1 / ADR-172 Wave 1 — lazy INQUIRY booking for payable chat invoice.
 *
 * Host-initiated quote: creates inquiry row via canonical `createInquiryBooking`
 * with `negotiationRequest: true` (skips client price attestation).
 * Inquiry soft-hold is skipped by that path; calendar blocking stays on `invoice_hold`
 * in `post-chat-invoice.server.js`.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createInquiryBooking } from '@/lib/services/booking/inquiry.service.js'

/**
 * @param {{
 *   conversation: { id?: string, listing_id?: string, partner_id?: string, owner_id?: string, renter_id?: string, renter_name?: string },
 *   listingId: string,
 *   checkIn: string,
 *   checkOut: string,
 *   guestsCount?: number,
 *   hostUserId?: string | null,
 * }} params
 * @returns {Promise<
 *   | { ok: true, bookingId: string, booking: object, conversationId: string | null }
 *   | { ok: false, error: string, code?: string, status?: number }
 * >}
 */
export async function ensureInquiryBookingForChatInvoice({
  conversation,
  listingId,
  checkIn,
  checkOut,
  guestsCount = 1,
  hostUserId = null,
}) {
  if (!conversation?.id) {
    return { ok: false, error: 'conversation_required', status: 400 }
  }

  const renterId = conversation.renter_id ?? null
  if (!renterId) {
    return { ok: false, error: 'renter_required_for_invoice_booking', status: 400 }
  }

  const convListingId = conversation.listing_id ? String(conversation.listing_id) : null
  const targetListingId = String(listingId || convListingId || '').trim()
  if (!targetListingId) {
    return { ok: false, error: 'listing_id_required', status: 400 }
  }
  if (convListingId && convListingId !== targetListingId) {
    return { ok: false, error: 'listing_id_mismatch_conversation', status: 400 }
  }

  const partnerId = conversation.partner_id || conversation.owner_id
  if (hostUserId && partnerId && String(hostUserId) !== String(partnerId)) {
    return { ok: false, error: 'forbidden', status: 403 }
  }

  const cin = String(checkIn || '').trim()
  const cout = String(checkOut || '').trim()
  if (!cin || !cout) {
    return { ok: false, error: 'check_in_and_check_out_required', status: 400 }
  }

  let guestName = conversation.renter_name || 'Guest'
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('first_name,last_name,email')
      .eq('id', renterId)
      .maybeSingle()
    if (profile) {
      const name = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim()
      guestName = name || profile.email || guestName
    }
  } catch {
    /* non-critical */
  }

  const result = await createInquiryBooking({
    listingId: targetListingId,
    renterId,
    checkIn: cin,
    checkOut: cout,
    guestName,
    guestsCount: Math.max(1, parseInt(guestsCount, 10) || 1),
    negotiationRequest: true,
    specialRequests: '[ADR-172] Host-initiated chat invoice — lazy inquiry booking.',
    currency: 'THB',
  })

  if (result.error) {
    const errText = String(result.error)
    const status =
      result.code === 'DATES_CONFLICT' || errText.includes('CONFLICT') || errText.includes('capacity')
        ? 409
        : 400
    return { ok: false, error: errText, code: result.code, status }
  }

  const bookingId = result.booking?.id
  if (!bookingId) {
    return { ok: false, error: 'inquiry_booking_create_failed', status: 500 }
  }

  return {
    ok: true,
    bookingId: String(bookingId),
    booking: result.booking,
    conversationId: result.conversationId || conversation.id || null,
  }
}
