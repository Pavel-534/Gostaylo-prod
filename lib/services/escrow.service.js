/**
 * FunnyRent 2.1 - Escrow & Payout Service
 * Handles escrow logic, automated payouts, and commission calculations
 */

import { supabaseAdmin } from '@/lib/supabase';
import { NotificationService, NotificationEvents } from './notification.service';

// Commission rate (15%)
const COMMISSION_RATE = 0.15;

// Payout time (18:00 local time)
const PAYOUT_HOUR = 18;

// Booking statuses
export const BookingStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PAID_ESCROW: 'PAID_ESCROW',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

// Payout statuses
export const PayoutStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

export class EscrowService {
  
  /**
   * Move booking to PAID_ESCROW status after payment confirmed
   * @param {string} bookingId - Booking ID
   * @param {object} paymentData - Payment verification data
   */
  static async moveToEscrow(bookingId, paymentData = {}) {
    try {
      // Get booking details
      const { data: booking, error: fetchError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          listing:listings(
            id,
            title,
            owner_id,
            owner:profiles!owner_id(
              id,
              email,
              telegram_id,
              name
            )
          )
        `)
        .eq('id', bookingId)
        .single();

      if (fetchError || !booking) {
        console.error('[ESCROW] Booking not found:', fetchError);
        return { success: false, error: 'Booking not found' };
      }

      // Calculate amounts
      const totalAmount = parseFloat(booking.price_thb) || 0;
      const commission = Math.round(totalAmount * COMMISSION_RATE * 100) / 100;
      const netAmount = totalAmount - commission;

      // Update booking to PAID_ESCROW
      const { data: updatedBooking, error: updateError } = await supabaseAdmin
        .from('bookings')
        .update({
          status: BookingStatus.PAID_ESCROW,
          commission_thb: commission,
          net_amount_thb: netAmount,
          escrow_at: new Date().toISOString(),
          metadata: {
            ...(booking.metadata || {}),
            escrow_started: new Date().toISOString(),
            payment_verification: paymentData
          }
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateError) {
        console.error('[ESCROW] Update failed:', updateError);
        return { success: false, error: updateError.message };
      }

      // Send notification to partner
      await NotificationService.dispatch('PAYMENT_RECEIVED', {
        booking: updatedBooking,
        listing: booking.listing,
        partner: booking.listing?.owner,
        payment: {
          amount: totalAmount,
          commission,
          netAmount
        }
      });

      console.log(`[ESCROW] Booking ${bookingId} moved to escrow. Net: ฿${netAmount}`);

      return { 
        success: true, 
        booking: updatedBooking,
        escrow: {
          totalAmount,
          commission,
          netAmount,
          escrowedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[ESCROW] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Process payout for a booking (called on check-in day at 18:00)
   * @param {string} bookingId - Booking ID
   */
  static async processPayout(bookingId) {
    try {
      // Get booking details
      const { data: booking, error: fetchError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          listing:listings(
            id,
            title,
            owner_id,
            owner:profiles!owner_id(
              id,
              email,
              telegram_id,
              name
            )
          )
        `)
        .eq('id', bookingId)
        .single();

      if (fetchError || !booking) {
        return { success: false, error: 'Booking not found' };
      }

      // Check if booking is in PAID_ESCROW status
      if (booking.status !== BookingStatus.PAID_ESCROW) {
        return { success: false, error: `Invalid status: ${booking.status}` };
      }

      // Calculate net amount (15% commission deducted)
      const totalAmount = parseFloat(booking.price_thb) || 0;
      const commission = parseFloat(booking.commission_thb) || Math.round(totalAmount * COMMISSION_RATE * 100) / 100;
      const netAmount = parseFloat(booking.net_amount_thb) || (totalAmount - commission);

      // Create payout record
      const { data: payout, error: payoutError } = await supabaseAdmin
        .from('payouts')
        .insert({
          partner_id: booking.listing?.owner_id,
          booking_id: bookingId,
          amount: netAmount,
          currency: 'THB',
          commission_amount: commission,
          commission_rate: COMMISSION_RATE,
          status: PayoutStatus.COMPLETED,
          processed_at: new Date().toISOString(),
          metadata: {
            total_booking_amount: totalAmount,
            listing_title: booking.listing?.title
          }
        })
        .select()
        .single();

      if (payoutError) {
        // If payouts table doesn't exist, just update booking
        console.warn('[PAYOUT] Could not create payout record:', payoutError);
      }

      // Update booking to COMPLETED
      const { data: completedBooking, error: completeError } = await supabaseAdmin
        .from('bookings')
        .update({
          status: BookingStatus.COMPLETED,
          completed_at: new Date().toISOString(),
          payout_at: new Date().toISOString(),
          metadata: {
            ...(booking.metadata || {}),
            payout_processed: new Date().toISOString(),
            payout_amount: netAmount
          }
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (completeError) {
        console.error('[PAYOUT] Booking update failed:', completeError);
        return { success: false, error: completeError.message };
      }

      // Send payout notification to partner
      await NotificationService.dispatch(NotificationEvents.PAYOUT_PROCESSED, {
        payout: {
          amount: netAmount,
          commission,
          total: totalAmount
        },
        booking: completedBooking,
        listing: booking.listing,
        partner: booking.listing?.owner
      });

      console.log(`[PAYOUT] Booking ${bookingId} completed. Payout: ฿${netAmount}`);

      return {
        success: true,
        payout: {
          amount: netAmount,
          commission,
          total: totalAmount,
          processedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[PAYOUT] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all bookings ready for payout (check-in today, status = PAID_ESCROW)
   * Called by cron job at 18:00
   */
  static async getPayoutReadyBookings() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select(`
          id,
          check_in,
          price_thb,
          commission_thb,
          net_amount_thb,
          listing:listings(
            id,
            title,
            owner_id
          )
        `)
        .eq('status', BookingStatus.PAID_ESCROW)
        .eq('check_in', today);

      if (error) {
        console.error('[PAYOUT] Query error:', error);
        return { success: false, bookings: [] };
      }

      return { success: true, bookings: data || [] };

    } catch (error) {
      console.error('[PAYOUT] Error:', error);
      return { success: false, bookings: [] };
    }
  }

  /**
   * Process all payouts for today (called by cron at 18:00)
   */
  static async processAllPayoutsForToday() {
    try {
      const { bookings } = await this.getPayoutReadyBookings();
      
      if (!bookings || bookings.length === 0) {
        console.log('[PAYOUT CRON] No bookings ready for payout today');
        return { success: true, processed: 0, results: [] };
      }

      const results = [];
      for (const booking of bookings) {
        const result = await this.processPayout(booking.id);
        results.push({
          bookingId: booking.id,
          ...result
        });
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`[PAYOUT CRON] Processed ${successCount}/${bookings.length} payouts`);

      return {
        success: true,
        processed: successCount,
        total: bookings.length,
        results
      };

    } catch (error) {
      console.error('[PAYOUT CRON] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get partner's balance summary
   * @param {string} partnerId - Partner ID
   */
  static async getPartnerBalance(partnerId) {
    try {
      // Get all partner bookings
      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('price_thb, commission_thb, net_amount_thb, status')
        .eq('partner_id', partnerId);

      // Calculate totals
      let totalEarnings = 0;
      let totalCommission = 0;
      let escrowBalance = 0;
      let availableBalance = 0;
      let pendingPayouts = 0;

      (bookings || []).forEach(b => {
        const net = parseFloat(b.net_amount_thb) || (parseFloat(b.price_thb) * 0.85);
        const comm = parseFloat(b.commission_thb) || (parseFloat(b.price_thb) * 0.15);

        if (b.status === BookingStatus.COMPLETED) {
          totalEarnings += net;
          totalCommission += comm;
          availableBalance += net;
        } else if (b.status === BookingStatus.PAID_ESCROW) {
          totalEarnings += net;
          totalCommission += comm;
          escrowBalance += net;
          pendingPayouts += net;
        }
      });

      return {
        success: true,
        balance: {
          totalEarnings: Math.round(totalEarnings * 100) / 100,
          totalCommission: Math.round(totalCommission * 100) / 100,
          escrowBalance: Math.round(escrowBalance * 100) / 100,
          availableBalance: Math.round(availableBalance * 100) / 100,
          pendingPayouts: Math.round(pendingPayouts * 100) / 100
        }
      };

    } catch (error) {
      console.error('[BALANCE] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Request manual payout (for available balance)
   * @param {string} partnerId - Partner ID
   * @param {number} amount - Amount to withdraw
   * @param {object} details - Payout details (wallet address, bank account)
   */
  static async requestPayout(partnerId, amount, details) {
    try {
      const { balance } = await this.getPartnerBalance(partnerId);
      
      if (amount > balance.availableBalance) {
        return { 
          success: false, 
          error: `Insufficient balance. Available: ฿${balance.availableBalance}` 
        };
      }

      const { data: payout, error } = await supabaseAdmin
        .from('payouts')
        .insert({
          partner_id: partnerId,
          amount,
          currency: 'THB',
          status: PayoutStatus.PENDING,
          wallet_address: details.walletAddress || null,
          bank_account: details.bankAccount || null,
          metadata: {
            requested_at: new Date().toISOString(),
            payout_type: 'manual'
          }
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, payout };

    } catch (error) {
      console.error('[PAYOUT REQUEST] Error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default EscrowService;
