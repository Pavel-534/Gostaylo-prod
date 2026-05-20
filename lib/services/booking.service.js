/**
 * GoStayLo — Booking orchestrator (Stage 2.1)
 *
 * Тяжёлая логика вынесена в `lib/services/booking/`:
 *   - `query.service.js` — выборки, `conversation_id`, `resolveListingCategorySlug`
 *   - `pricing.service.js` — settlement в `pricing_snapshot` (не путать с `lib/services/pricing.service.js`)
 *   - `inquiry.service.js` — чат/inquiry, календарь, `createInquiryBooking`
 *   - `creation.js` — `createBooking` (стандартный поток)
 */

import { supabaseAdmin } from '@/lib/supabase';
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync';
import { getBookings, getBookingById, resolveListingCategorySlug } from './booking/query.service';
import { attachSettlementSnapshotForBooking } from './booking/pricing.service';
import {
  checkAvailability,
  verifyInventoryBeforePartnerConfirm,
  createInquiryBooking,
  ensureBookingConversation,
} from './booking/inquiry.service';
import { createBooking } from './booking/creation.js';
import { validatePartnerBookingStatusTransition } from '@/lib/booking/status-transitions.js';

export { resolveListingCategorySlug, ensureBookingConversation };

export class BookingService {
  static async attachSettlementSnapshotForBooking(bookingId) {
    return attachSettlementSnapshotForBooking(bookingId);
  }

  static async checkAvailability(listingId, checkIn, checkOut, options) {
    return checkAvailability(listingId, checkIn, checkOut, options);
  }

  static async verifyInventoryBeforePartnerConfirm(bookingId) {
    return verifyInventoryBeforePartnerConfirm(bookingId);
  }

  static async createBooking(bookingData) {
    return createBooking(bookingData);
  }

  static async createInquiryBooking(bookingData) {
    return createInquiryBooking(bookingData);
  }

  static async getBookings(filters) {
    return getBookings(filters);
  }

  static async getBookingById(bookingId, options) {
    return getBookingById(bookingId, options);
  }

  /**
   * Staff-only status change (`PUT /api/v2/bookings/[id]`, cron cleanup).
   * Граф переходов и PATCH-поля — SSOT `lib/booking/status-transitions.js`.
   *
   * @deprecated Для продуктовых сценариев предпочитайте partner API и check-in route.
   *             Новые фичи не должны добавлять вызовы этого метода.
   */
  static async updateStatus(bookingId, newStatus, metadata = {}) {
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return { error: 'Booking not found' };
    }

    const transition = validatePartnerBookingStatusTransition(
      booking.status,
      newStatus,
      { checkedInAt: metadata.checkedInAt },
    );
    if (!transition.ok) {
      return { error: transition.error };
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update(transition.patch)
      .eq('id', bookingId)
      .select()
      .single();

    if (updateError) {
      return { error: updateError.message };
    }

    try {
      await syncBookingStatusToConversationChat({
        bookingId,
        previousStatus: booking.status,
        newStatus,
        declineReasonKey: metadata.declineReasonKey,
        declineReasonDetail: metadata.declineReasonDetail,
        reasonFreeText: metadata.reason,
      });
    } catch (e) {
      console.error('[BookingService] chat sync', e);
    }

    return { success: true, booking: updated };
  }
}

export default BookingService;
