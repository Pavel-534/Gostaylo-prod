/**
 * GoStayLo - Escrow & Payout Service
 * Handles escrow logic, automated payouts, and commission calculations
 * 
 * DYNAMIC COMMISSION SYSTEM:
 * - Commission rate is SNAPSHOTTED at booking creation time
 * - Stored in `applied_commission_rate` field
 * - This rate is used for all future calculations, even if global rate changes
 * 
 * 24H ESCROW RULE:
 * - Payouts released at 18:00 local time on DAY AFTER check-in
 * - This 24h buffer protects guests from no-shows
 */

import { supabaseAdmin } from '@/lib/supabase';
import { resolveDefaultCommissionPercent } from '@/lib/services/currency.service';
import { NotificationService, NotificationEvents } from './notification.service';
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync';
import { PayoutRailsService } from '@/lib/services/payout-rails.service';
import LedgerService from '@/lib/services/ledger.service';

// Payout time (18:00 local time)
const PAYOUT_HOUR = 18;

// Escrow thaw delay (24 hours after check-in)
const ESCROW_THAW_DAYS = 1;

/** Параллельных выплат в одном cron-прогоне (ниже нагрузка на пул Supabase, чем полный Promise.all). */
const PAYOUT_CRON_CONCURRENCY = 5;

function extractSettlementSnapshot(booking) {
  const snap = booking?.pricing_snapshot;
  if (!snap || typeof snap !== 'object' || Array.isArray(snap)) return null;
  const settlement = snap.settlement_v3;
  if (!settlement || typeof settlement !== 'object') return null;
  return settlement;
}

/**
 * @template T, R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} mapper
 * @returns {Promise<R[]>}
 */
async function mapWithConcurrency(items, limit, mapper) {
  if (!items?.length) return [];
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    for (;;) {
      const i = index++;
      if (i >= items.length) break;
      results[i] = await mapper(items[i], i);
    }
  }
  const pool = Math.min(Math.max(1, limit), items.length);
  await Promise.all(Array.from({ length: pool }, () => worker()));
  return results;
}

function normalizeDelayDays(raw, fallback = ESCROW_THAW_DAYS) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(60, n)
}

function normalizePayoutHour(raw, fallback = PAYOUT_HOUR) {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0 || n > 23) return fallback
  return n
}

// Booking statuses
export const BookingStatus = {
  PENDING: 'PENDING',
  CONFIRMED: 'CONFIRMED',
  PAID_ESCROW: 'PAID_ESCROW',
  THAWED: 'THAWED',        // NEW: After 24h buffer, ready for payout
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
};

// Payout statuses
export const PayoutStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REJECTED: 'REJECTED',
};

export class EscrowService {
  /**
   * Settlement policy from system_settings.general:
   * - settlementPayoutDelayDays (0..60)
   * - settlementPayoutHourLocal (0..23)
   */
  static async getSettlementPolicy() {
    try {
      const { data } = await supabaseAdmin
        .from('system_settings')
        .select('value')
        .eq('key', 'general')
        .maybeSingle()
      const delayDays = normalizeDelayDays(data?.value?.settlementPayoutDelayDays, ESCROW_THAW_DAYS)
      const payoutHourLocal = normalizePayoutHour(data?.value?.settlementPayoutHourLocal, PAYOUT_HOUR)
      return { delayDays, payoutHourLocal }
    } catch {
      return { delayDays: ESCROW_THAW_DAYS, payoutHourLocal: PAYOUT_HOUR }
    }
  }
  
  /**
   * Global platform commission as decimal (e.g. 0.15 for 15%).
   * @returns {Promise<number>}
   */
  static async getCurrentCommissionRate() {
    const pct = await resolveDefaultCommissionPercent();
    return pct / 100;
  }

  /**
   * Snapshot commission rate for a new booking
   * Called when booking is created
   * @param {string} bookingId - Booking ID
   * @returns {Promise<{success: boolean, rate: number}>}
   */
  static async snapshotCommissionRate(bookingId) {
    try {
      const rate = await this.getCurrentCommissionRate();
      
      const { error } = await supabaseAdmin
        .from('bookings')
        .update({ 
          applied_commission_rate: rate,
          metadata: supabaseAdmin.rpc('jsonb_set_key', {
            jsonb_data: {},
            key_path: ['commission_snapshotted_at'],
            new_value: new Date().toISOString()
          })
        })
        .eq('id', bookingId);
      
      if (error) {
        // Fallback: try simpler update
        await supabaseAdmin
          .from('bookings')
          .update({ applied_commission_rate: rate })
          .eq('id', bookingId);
      }
      
      console.log(`[COMMISSION SNAPSHOT] Booking ${bookingId}: ${(rate * 100).toFixed(1)}%`);
      return { success: true, rate };
    } catch (error) {
      console.error('[COMMISSION SNAPSHOT] Error:', error);
      const pct = await resolveDefaultCommissionPercent();
      return { success: false, rate: pct / 100 };
    }
  }

  /**
   * Commission ratio for math (0.15 = 15%). Uses snapshot, then booking.commission_rate (%), then system default.
   * @param {object} booking
   * @returns {Promise<number>}
   */
  static async getBookingCommissionRate(booking) {
    const settlement = extractSettlementSnapshot(booking);
    const fromSnapshot = parseFloat(settlement?.applied_commission_rate);
    if (Number.isFinite(fromSnapshot) && fromSnapshot >= 0) return fromSnapshot / 100;

    if (booking?.applied_commission_rate !== undefined && booking.applied_commission_rate !== null) {
      const r = parseFloat(booking.applied_commission_rate);
      if (Number.isFinite(r) && r >= 0) return r > 1 ? r / 100 : r;
    }
    const cr = parseFloat(booking?.commission_rate);
    if (Number.isFinite(cr) && cr >= 0) return cr / 100;
    const pct = await resolveDefaultCommissionPercent();
    return pct / 100;
  }
  
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

      if (booking.status === BookingStatus.PAID_ESCROW) {
        console.log(`[ESCROW] Booking ${bookingId} already in PAID_ESCROW (idempotent)`);
        const cr = await this.getBookingCommissionRate(booking);
        return {
          success: true,
          booking,
          alreadyEscrowed: true,
          escrow: {
            totalAmount: parseFloat(booking.price_thb) || 0,
            commission: parseFloat(booking.commission_thb) || 0,
            netAmount: parseFloat(booking.net_amount_thb) || 0,
            commissionRate: cr * 100,
            escrowedAt: booking.escrow_at || booking.updated_at,
          },
        };
      }

      const commissionRate = await this.getBookingCommissionRate(booking);
      const settlement = extractSettlementSnapshot(booking);

      const totalAmount = parseFloat(booking.price_thb) || 0;
      const commission = Number.isFinite(parseFloat(settlement?.platform_margin?.thb))
        ? parseFloat(settlement.platform_margin.thb)
        : Math.round(totalAmount * commissionRate * 100) / 100;
      const netAmount = Number.isFinite(parseFloat(settlement?.partner_net?.thb))
        ? parseFloat(settlement.partner_net.thb)
        : totalAmount - commission;

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
            payment_verification: paymentData,
            commission_rate_applied: commissionRate
          }
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (updateError) {
        console.error('[ESCROW] Update failed:', updateError);
        return { success: false, error: updateError.message };
      }

      try {
        const ledgerRes = await LedgerService.postPaymentCaptureFromBooking(updatedBooking);
        if (!ledgerRes.success && !ledgerRes.skipped) {
          console.error('[ESCROW] ledger post failed:', ledgerRes.error);
        }
      } catch (ledgerErr) {
        console.error('[ESCROW] ledger post exception', ledgerErr);
      }

      try {
        await syncBookingStatusToConversationChat({
          bookingId,
          previousStatus: booking.status,
          newStatus: BookingStatus.PAID_ESCROW,
        });
      } catch (e) {
        console.error('[ESCROW] chat sync', e);
      }

      // Send notification to partner
      await NotificationService.dispatch('PAYMENT_RECEIVED', {
        booking: updatedBooking,
        listing: booking.listing,
        partner: booking.listing?.owner,
        payment: {
          amount: totalAmount,
          commission,
          netAmount,
          commissionRate: commissionRate * 100 // percentage for display
        }
      });

      console.log(`[ESCROW] Booking ${bookingId} moved to escrow. Commission: ${(commissionRate * 100).toFixed(1)}%, Net: ฿${netAmount}`);

      return { 
        success: true, 
        booking: updatedBooking,
        escrow: {
          totalAmount,
          commission,
          netAmount,
          commissionRate: commissionRate * 100,
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
   * Uses SNAPSHOTTED commission rate from booking time
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

      const commissionRate = await this.getBookingCommissionRate(booking);
      const settlement = extractSettlementSnapshot(booking);

      const totalAmount = parseFloat(booking.price_thb) || 0;
      const commission = Number.isFinite(parseFloat(settlement?.platform_margin?.thb))
        ? parseFloat(settlement.platform_margin.thb)
        : parseFloat(booking.commission_thb) || Math.round(totalAmount * commissionRate * 100) / 100;
      const netAmount = Number.isFinite(parseFloat(settlement?.partner_net?.thb))
        ? parseFloat(settlement.partner_net.thb)
        : parseFloat(booking.net_amount_thb) || (totalAmount - commission);
      const partnerId = booking.listing?.owner_id;

      let payoutProfile = null;
      let payoutMethod = null;
      let payoutMath = { baseAmount: netAmount, feeAmount: 0, finalAmount: netAmount };
      try {
        payoutProfile = partnerId
          ? await PayoutRailsService.getPartnerDefaultPayoutProfile(partnerId)
          : null;
        payoutMethod = payoutProfile?.method || null;
        payoutMath = PayoutRailsService.calculatePayoutFee(netAmount, payoutMethod);
      } catch (e) {
        console.error('[PAYOUT] payout profile resolve error:', e);
      }
      if (payoutMath?.error) {
        return { success: false, error: payoutMath.error };
      }

      // Create payout record
      const { data: _payout, error: payoutError } = await supabaseAdmin
        .from('payouts')
        .insert({
          partner_id: partnerId,
          booking_id: bookingId,
          amount: payoutMath.finalAmount,
          currency: payoutMethod?.currency || 'THB',
          commission_amount: commission,
          commission_rate: commissionRate,
          payout_method_id: payoutMethod?.id || null,
          payout_profile_id: payoutProfile?.id || null,
          gross_amount: payoutMath.baseAmount,
          payout_fee_amount: payoutMath.feeAmount,
          final_amount: payoutMath.finalAmount,
          status: PayoutStatus.COMPLETED,
          processed_at: new Date().toISOString(),
          metadata: {
            total_booking_amount: totalAmount,
            listing_title: booking.listing?.title,
            commission_rate_percent: commissionRate * 100,
            payout_method_name: payoutMethod?.name || null,
            payout_fee_type: payoutMath.feeType || null,
            payout_fee_value: payoutMath.feeValue ?? null,
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
            payout_amount: netAmount,
            payout_commission_rate: commissionRate * 100
          }
        })
        .eq('id', bookingId)
        .select()
        .single();

      if (completeError) {
        console.error('[PAYOUT] Booking update failed:', completeError);
        return { success: false, error: completeError.message };
      }

      try {
        await syncBookingStatusToConversationChat({
          bookingId,
          previousStatus: booking.status,
          newStatus: BookingStatus.COMPLETED,
        });
      } catch (e) {
        console.error('[PAYOUT] chat sync', e);
      }

      // Send payout notification to partner with commission details
      await NotificationService.dispatch(NotificationEvents.PAYOUT_PROCESSED, {
        payout: {
          amount: payoutMath.finalAmount,
          grossAmount: payoutMath.baseAmount,
          payoutFeeAmount: payoutMath.feeAmount,
          commission,
          total: totalAmount,
          commissionRate: commissionRate * 100 // Show percentage in notification
        },
        booking: completedBooking,
        listing: booking.listing,
        partner: booking.listing?.owner
      });

      console.log(
        `[PAYOUT] Booking ${bookingId} completed. Commission: ${(commissionRate * 100).toFixed(1)}%, Payout: ฿${payoutMath.finalAmount}`
      );

      return {
        success: true,
        payout: {
          amount: payoutMath.finalAmount,
          grossAmount: payoutMath.baseAmount,
          payoutFeeAmount: payoutMath.feeAmount,
          commission,
          total: totalAmount,
          commissionRate: commissionRate * 100,
          processedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('[PAYOUT] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get all bookings ready for payout (check-in YESTERDAY, status = PAID_ESCROW)
   * 24H RULE: Payouts are processed on the DAY AFTER check-in at 18:00
   * Called by cron job at 18:00
   */
  static async getPayoutReadyBookings() {
    try {
      const policy = await this.getSettlementPolicy()
      // delayDays=0 => same day payouts, 1 => next day, 30 => monthly-like hold.
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - policy.delayDays);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select(`
          id,
          check_in,
          price_thb,
          commission_thb,
          net_amount_thb,
          applied_commission_rate,
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
        .eq('status', BookingStatus.PAID_ESCROW)
        .lte('check_in', yesterdayStr); // Check-in was yesterday or earlier

      if (error) {
        console.error('[PAYOUT] Query error:', error);
        return { success: false, bookings: [] };
      }

      console.log(
        `[PAYOUT] Found ${data?.length || 0} bookings ready for payout (check-in ≤ ${yesterdayStr}, delayDays=${policy.delayDays}, payoutHourLocal=${policy.payoutHourLocal})`
      );
      return { success: true, bookings: data || [] };

    } catch (error) {
      console.error('[PAYOUT] Error:', error);
      return { success: false, bookings: [] };
    }
  }

  /**
   * Get bookings that will be thawed tomorrow (for admin notification)
   * These are bookings with check-in TODAY
   */
  static async getUpcomingThawBookings() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabaseAdmin
        .from('bookings')
        .select(`
          id,
          check_in,
          price_thb,
          net_amount_thb,
          listing:listings(id, title, owner_id)
        `)
        .eq('status', BookingStatus.PAID_ESCROW)
        .eq('check_in', today);

      if (error) {
        console.error('[THAW PREVIEW] Query error:', error);
        return { success: false, bookings: [] };
      }

      return { success: true, bookings: data || [] };

    } catch (error) {
      console.error('[THAW PREVIEW] Error:', error);
      return { success: false, bookings: [] };
    }
  }

  /**
   * Process all payouts for today (called by cron at 18:00)
   * 24H RULE: Only processes bookings where check-in was YESTERDAY
   */
  static async processAllPayoutsForToday() {
    try {
      const { bookings } = await this.getPayoutReadyBookings();
      
      if (!bookings || bookings.length === 0) {
        console.log('[PAYOUT CRON] No bookings ready for payout (24h rule)');
        return { success: true, processed: 0, results: [] };
      }

      const results = await mapWithConcurrency(
        bookings,
        PAYOUT_CRON_CONCURRENCY,
        async (booking) => {
          const result = await this.processPayout(booking.id);
          return {
            bookingId: booking.id,
            listingTitle: booking.listing?.title,
            amount: booking.net_amount_thb,
            ...result,
          };
        },
      );

      const successCount = results.filter(r => r.success).length;
      console.log(`[PAYOUT CRON] Processed ${successCount}/${bookings.length} payouts`);

      // Notify admin about processed payouts
      if (successCount > 0) {
        await NotificationService.dispatch('PAYOUT_BATCH_COMPLETED', {
          count: successCount,
          total: bookings.length,
          results
        });
      }

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
   * Notify admin about bookings that will be "thawed" tomorrow
   * Called at end of day to preview next day's payouts
   */
  static async notifyUpcomingThaw() {
    try {
      const { bookings } = await this.getUpcomingThawBookings();
      
      if (!bookings || bookings.length === 0) {
        return { success: true, message: 'No bookings to thaw tomorrow' };
      }

      // Notify admin topic about upcoming thaw
      await NotificationService.dispatch('ESCROW_THAW_PREVIEW', {
        bookings,
        thawDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      });

      console.log(`[THAW PREVIEW] ${bookings.length} bookings will be thawed tomorrow`);
      
      return {
        success: true,
        count: bookings.length,
        bookings: bookings.map(b => ({
          id: b.id,
          listing: b.listing?.title,
          amount: b.net_amount_thb
        }))
      };

    } catch (error) {
      console.error('[THAW PREVIEW] Error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get partner's balance summary
   * @param {string} partnerId - Partner ID
   */
  static async getPartnerBalance(partnerId) {
    try {
      const fallbackPct = await resolveDefaultCommissionPercent();
      const fallbackRatio = fallbackPct / 100;

      // Get all partner bookings
      const { data: bookings } = await supabaseAdmin
        .from('bookings')
        .select('price_thb, commission_thb, net_amount_thb, commission_rate, status, pricing_snapshot')
        .eq('partner_id', partnerId);

      // Calculate totals
      let totalEarnings = 0;
      let totalCommission = 0;
      let escrowBalance = 0;
      let availableBalance = 0;
      let pendingPayouts = 0;

      (bookings || []).forEach(b => {
        const settlement = extractSettlementSnapshot(b);
        const price = parseFloat(b.price_thb) || 0;
        const cr = parseFloat(b.commission_rate);
        const ratio = Number.isFinite(cr) && cr >= 0 ? cr / 100 : fallbackRatio;
        const comm = Number.isFinite(parseFloat(settlement?.platform_margin?.thb))
          ? parseFloat(settlement.platform_margin.thb)
          : parseFloat(b.commission_thb) || price * ratio;
        const net = Number.isFinite(parseFloat(settlement?.partner_net?.thb))
          ? parseFloat(settlement.partner_net.thb)
          : parseFloat(b.net_amount_thb) || price - comm;

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

      let payoutProfile = null;
      if (details?.payoutProfileId) {
        const profiles = await PayoutRailsService.listPartnerPayoutProfiles(partnerId);
        payoutProfile = profiles.find((p) => p.id === details.payoutProfileId) || null;
      } else {
        payoutProfile = await PayoutRailsService.getPartnerDefaultPayoutProfile(partnerId);
      }
      const payoutMethod = payoutProfile?.method || null;
      const payoutMath = PayoutRailsService.calculatePayoutFee(amount, payoutMethod);
      if (payoutMath?.error) {
        return { success: false, error: payoutMath.error };
      }

      const { data: payout, error } = await supabaseAdmin
        .from('payouts')
        .insert({
          partner_id: partnerId,
          amount: payoutMath.finalAmount,
          gross_amount: payoutMath.baseAmount,
          payout_fee_amount: payoutMath.feeAmount,
          final_amount: payoutMath.finalAmount,
          payout_method_id: payoutMethod?.id || null,
          payout_profile_id: payoutProfile?.id || null,
          currency: payoutMethod?.currency || 'THB',
          status: PayoutStatus.PENDING,
          wallet_address: details.walletAddress || null,
          bank_account: details.bankAccount || null,
          metadata: {
            requested_at: new Date().toISOString(),
            payout_type: 'manual',
            payout_method_name: payoutMethod?.name || null,
            payout_fee_type: payoutMath.feeType || null,
            payout_fee_value: payoutMath.feeValue ?? null,
          }
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, payout, payoutMath };

    } catch (error) {
      console.error('[PAYOUT REQUEST] Error:', error);
      return { success: false, error: error.message };
    }
  }
}

export default EscrowService;
