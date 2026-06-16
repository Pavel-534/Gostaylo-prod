/**
 * GoStayLo — Booking orchestrator (Stage 2.1)
 *
 * Тяжёлая логика вынесена в `lib/services/booking/`:
 *   - `query.service.js` — выборки, `conversation_id`, `resolveListingCategorySlug`
 *   - `pricing.service.js` — settlement в `pricing_snapshot` (не путать с `lib/services/pricing.service.js`)
 *   - `inquiry.service.js` — чат/inquiry, календарь, `createInquiryBooking`
 *   - `creation.js` — `createBooking` (стандартный поток)
 */

import { getBookings, getBookingById, resolveListingCategorySlug, resolveListingCategoryContext } from './booking/query.service';
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js';
import { attachSettlementSnapshotForBooking } from './booking/pricing.service';
import {
  checkAvailability,
  verifyInventoryBeforePartnerConfirm,
  createInquiryBooking,
  ensureBookingConversation,
} from './booking/inquiry.service';
import { createBooking } from './booking/creation.js';

export { resolveListingCategorySlug, resolveListingCategoryContext, ensureBookingConversation };

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
   * Staff / cron status change — делегирует в `transitionBookingStatus` (Stage 119.2).
   * Новый код: `import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'`.
   */
  static async updateStatus(bookingId, newStatus, metadata = {}) {
    const scope = metadata.bookingStatusScope || metadata.scope || 'partner';
    const result = await transitionBookingStatus(bookingId, newStatus, {
      scope,
      metadata,
      actorContext: {
        trigger: metadata.referralTrigger || 'booking_service_update_status',
      },
      allowStaffCancelCompleted: metadata.allowStaffCancelCompleted === true,
    });
    if (!result.success) {
      return { error: result.error || 'BOOKING_STATUS_TRANSITION_FAILED' };
    }
    return { success: true, booking: result.booking, referralLifecycle: result.referralLifecycle };
  }
}

export default BookingService;
