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

  static async updateStatus(bookingId, newStatus, metadata = {}) {
    const validTransitions = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      INQUIRY: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PAID', 'CANCELLED'],
      PAID: ['COMPLETED', 'REFUNDED'],
      COMPLETED: [],
      CANCELLED: [],
      REFUNDED: [],
    };

    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    if (error || !booking) {
      return { error: 'Booking not found' };
    }

    if (!validTransitions[booking.status]?.includes(newStatus)) {
      return { error: `Cannot transition from ${booking.status} to ${newStatus}` };
    }

    const updateData = { status: newStatus };

    if (newStatus === 'CONFIRMED') {
      updateData.confirmed_at = new Date().toISOString();
    } else if (newStatus === 'CANCELLED') {
      updateData.cancelled_at = new Date().toISOString();
    } else if (newStatus === 'COMPLETED') {
      updateData.completed_at = new Date().toISOString();
    } else if (newStatus === 'PAID') {
      updateData.checked_in_at = metadata.checkedInAt || new Date().toISOString();
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('bookings')
      .update(updateData)
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
