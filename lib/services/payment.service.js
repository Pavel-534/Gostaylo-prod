/**
 * Gostaylo - Payment Service v2.0
 * Handles escrow, crypto verification, and payout logic
 * 
 * PAYMENT METHODS:
 * - USDT_TRC20: Crypto payment via TRON network
 * - CARD_INTL: Visa/Mastercard (Stripe)
 * - CARD_RU: MIR cards (Russian)
 * - THAI_QR: PromptPay (Thai QR)
 */

import { supabaseAdmin } from '@/lib/supabase';
import { NotificationService, NotificationEvents } from './notification.service';
import { syncBookingStatusToConversationChat } from '@/lib/booking-status-chat-sync';
import { verifyTronTransaction, GOSTAYLO_WALLET } from './tron.service';

// Payment method enum (maps to DB enum)
export const PaymentMethod = {
  USDT_TRC20: 'CRYPTO',       // Maps to DB enum
  CARD_INTL: 'CARD',          // Visa/Master - maps to DB enum
  CARD_RU: 'MIR',             // MIR - maps to DB enum
  THAI_QR: 'CRYPTO'           // PromptPay (stored as CRYPTO for now)
};

// Frontend payment method labels
export const PaymentMethodLabels = {
  CRYPTO: 'USDT TRC-20',
  CARD: 'Card (Visa/MC)',
  MIR: 'МИР',
  THAI_QR: 'Thai QR'
};

// Payment status enum
export const PaymentStatus = {
  PENDING: 'PENDING',
  VERIFYING: 'VERIFYING',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
};

export class PaymentService {
  
  /**
   * Initialize payment for a booking
   */
  static async initializePayment(bookingId, method, currency = 'THB') {
    // Get booking details
    const { data: booking, error } = await supabaseAdmin
      .from('bookings')
      .select('*, listings(*)')
      .eq('id', bookingId)
      .single();
    
    if (error || !booking) {
      return { error: 'Booking not found' };
    }
    
    // Map old method names to new
    const methodMapping = {
      'CRYPTO': 'CRYPTO',   // DB enum value
      'CARD': 'CARD',       // DB enum value
      'MIR': 'MIR'          // DB enum value
    };
    const paymentMethod = methodMapping[method] || method;
    
    // Create payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id: bookingId,
        amount: booking.price_paid || booking.price_thb,
        currency: currency,
        method: paymentMethod,  // Use 'method' column, not 'payment_method'
        status: PaymentStatus.PENDING,
        metadata: {
          created_at: new Date().toISOString(),
          original_method: method  // Store original method name
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (paymentError) {
      console.error('[PAYMENT INIT ERROR]', paymentError);
      return { error: paymentError.message };
    }
    
    // Generate payment details based on method
    let paymentDetails = {};
    
    if (paymentMethod === PaymentMethod.USDT_TRC20) {
      // Convert THB to USDT (rough rate, should use live rate)
      const usdtRate = 35.5; // THB per USDT
      const usdtAmount = Math.ceil((booking.price_thb / usdtRate) * 100) / 100;
      
      paymentDetails = {
        walletAddress: GOSTAYLO_WALLET,
        network: 'TRC-20',
        currency: 'USDT',
        amount: usdtAmount,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min expiry
      };
    } else if (paymentMethod === PaymentMethod.CARD_INTL) {
      paymentDetails = {
        // Stripe session would be created here
        redirectUrl: `/checkout/${bookingId}/pay`
      };
    } else if (paymentMethod === PaymentMethod.CARD_RU) {
      paymentDetails = {
        // MIR payment gateway details
        redirectUrl: `/checkout/${bookingId}/pay-mir`
      };
    } else if (paymentMethod === PaymentMethod.THAI_QR) {
      paymentDetails = {
        // PromptPay QR
        redirectUrl: `/checkout/${bookingId}/pay-qr`
      };
    }
    
    return {
      success: true,
      payment: {
        ...payment,
        metadata: paymentDetails
      }
    };
  }
  
  /**
   * Submit TXID for crypto payment verification
   */
  static async submitTxid(bookingId, txid, paymentMethod = 'CRYPTO') {
    try {
      // Get booking info for notification
      const { data: booking, error: bookingError } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          listing:listings(
            id,
            title,
            district,
            owner_id
          )
        `)
        .eq('id', bookingId)
        .single();

      if (bookingError) {
        console.error('[SUBMIT TXID] Booking error:', bookingError);
        return { success: false, error: 'Booking not found' };
      }

      if (!booking) {
        return { success: false, error: 'Booking not found' };
      }

      // Get partner info separately if needed
      let partner = null;
      if (booking.listing?.owner_id) {
        const { data: partnerData } = await supabaseAdmin
          .from('profiles')
          .select('id, email, telegram_id, name')
          .eq('id', booking.listing.owner_id)
          .single();
        partner = partnerData;
      }

      // Check for existing payment
      const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let payment;
      if (existingPayment) {
        // Update existing payment
        const { data, error } = await supabaseAdmin
          .from('payments')
          .update({
            tx_id: txid,
            status: 'PENDING',
            metadata: {
              ...(existingPayment.metadata || {}),
              txid_submitted_at: new Date().toISOString()
            }
          })
          .eq('id', existingPayment.id)
          .select()
          .single();

        if (error) throw error;
        payment = data;
      } else {
        // Create new payment
        const { data, error } = await supabaseAdmin
          .from('payments')
          .insert({
            booking_id: bookingId,
            amount: booking.price_thb || 0,
            currency: 'THB',
            method: paymentMethod,
            tx_id: txid,
            status: 'PENDING',
            metadata: {
              txid_submitted_at: new Date().toISOString()
            }
          })
          .select()
          .single();

        if (error) throw error;
        payment = data;
      }

      // Send notification to admin (Finance thread)
      await NotificationService.dispatch('PAYMENT_SUBMITTED', {
        payment: { ...payment, txid: txid, payment_method: 'USDT_TRC20' },
        booking,
        listing: booking?.listing,
        partner
      });

      return { success: true, payment };
    } catch (error) {
      console.error('[SUBMIT TXID ERROR]', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Verify crypto payment using LIVE TronScan API
   */
  static async verifyCryptoPayment(bookingId, txid, expectedAmount = null) {
    // Get payment record
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (!payment) {
      return { success: false, error: 'Payment not found', status: 'NOT_FOUND' };
    }

    // Use the txid from payment if not provided
    const txidToVerify = txid || payment.txid;
    if (!txidToVerify) {
      return { success: false, error: 'No TXID to verify', status: 'INVALID' };
    }
    
    // LIVE verification using TronScan API
    const verificationResult = await verifyTronTransaction(txidToVerify);
    
    // Update payment with verification result
    await supabaseAdmin
      .from('payments')
      .update({
        status: verificationResult.success ? PaymentStatus.CONFIRMED : PaymentStatus.PENDING,
        metadata: {
          ...(payment.metadata || {}),
          verification: verificationResult,
          verified_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);
    
    if (verificationResult.success) {
      const { data: bStatusRow } = await supabaseAdmin
        .from('bookings')
        .select('status')
        .eq('id', bookingId)
        .single();
      const prevSt = bStatusRow?.status;

      // Update booking to PAID/CONFIRMED
      await supabaseAdmin
        .from('bookings')
        .update({ 
          status: 'CONFIRMED',
          updated_at: new Date().toISOString()
        })
        .eq('id', bookingId);

      try {
        await syncBookingStatusToConversationChat({
          bookingId,
          previousStatus: prevSt,
          newStatus: 'CONFIRMED',
        });
      } catch (e) {
        console.error('[verifyCryptoPayment] chat sync', e);
      }

      // Get full booking for notification
      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select(`
          *,
          listing:listings(title, owner_id),
          renter:profiles!renter_id(id, email, first_name)
        `)
        .eq('id', bookingId)
        .single();
      
      // Send notification
      if (booking) {
        await NotificationService.dispatch(NotificationEvents.PAYMENT_RECEIVED, {
          booking,
          payment: { ...payment, status: PaymentStatus.CONFIRMED },
          renter: booking.renter,
          listing: booking.listing
        });
      }
    }
    
    return {
      success: verificationResult.success,
      status: verificationResult.status,
      verified: verificationResult.success,
      data: verificationResult.data,
      error: verificationResult.error
    };
  }
  
  /**
   * Get all pending payments for admin dashboard
   */
  static async getPendingPayments(filters = {}) {
    try {
      let query = supabaseAdmin
        .from('payments')
        .select(`
          *,
          booking:bookings(
            id,
            guest_name,
            guest_email,
            guest_phone,
            check_in,
            check_out,
            price_thb,
            listing:listings(
              id,
              title,
              district,
              owner_id
            )
          )
        `)
        .eq('status', 'PENDING')  // Only PENDING in DB enum
        .order('created_at', { ascending: false });

      // Filter by payment method if specified
      if (filters.paymentMethod) {
        query = query.eq('method', filters.paymentMethod);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[PENDING PAYMENTS ERROR]', error);
        return { success: false, error: error.message, payments: [] };
      }

      // Map tx_id to txid for frontend compatibility
      const mappedPayments = (data || []).map(p => ({
        ...p,
        txid: p.tx_id,
        payment_method: p.method === 'CRYPTO' ? 'USDT_TRC20' : p.method
      }));

      return { success: true, payments: mappedPayments };
    } catch (error) {
      console.error('[PENDING PAYMENTS ERROR]', error);
      return { success: false, error: error.message, payments: [] };
    }
  }

  /**
   * Get all payments with filters
   */
  static async getPayments(filters = {}) {
    try {
      let query = supabaseAdmin
        .from('payments')
        .select(`
          *,
          booking:bookings(
            id,
            guest_name,
            guest_email,
            check_in,
            check_out,
            price_thb,
            listing:listings(
              id,
              title,
              district,
              owner_id
            )
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.paymentMethod) {
        // Map frontend method names to DB (no mapping needed now)
        query = query.eq('method', filters.paymentMethod);
      }
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[GET PAYMENTS ERROR]', error);
        return { success: false, error: error.message, payments: [] };
      }

      // Map tx_id to txid for frontend compatibility
      const mappedPayments = (data || []).map(p => ({
        ...p,
        txid: p.tx_id,
        payment_method: p.method === 'CRYPTO' ? 'USDT_TRC20' : p.method
      }));

      return { success: true, payments: mappedPayments };
    } catch (error) {
      console.error('[GET PAYMENTS ERROR]', error);
      return { success: false, error: error.message, payments: [] };
    }
  }

  /**
   * Count pending payments for badge
   */
  static async countPendingPayments() {
    try {
      const { data, error } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('status', 'PENDING');  // Only PENDING exists in DB enum

      if (error) {
        console.error('[COUNT PENDING ERROR]', error);
        return { success: false, count: 0 };
      }

      return { success: true, count: data?.length || 0 };
    } catch (error) {
      console.error('[COUNT PENDING ERROR]', error);
      return { success: false, count: 0 };
    }
  }

  /**
   * Admin: Confirm payment manually
   */
  static async confirmPayment(paymentId, verificationData = {}) {
    try {
      const { data: payBefore } = await supabaseAdmin
        .from('payments')
        .select('booking_id')
        .eq('id', paymentId)
        .single();
      let previousBookingStatus;
      if (payBefore?.booking_id) {
        const { data: b0 } = await supabaseAdmin
          .from('bookings')
          .select('status')
          .eq('id', payBefore.booking_id)
          .single();
        previousBookingStatus = b0?.status;
      }

      const { data: payment, error } = await supabaseAdmin
        .from('payments')
        .update({
          status: PaymentStatus.CONFIRMED,
          metadata: {
            verified_at: new Date().toISOString(),
            verified_manually: true,
            verification: verificationData
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .select(`
          *,
          booking:bookings(
            id,
            guest_name,
            guest_email,
            listing:listings(
              id,
              title,
              owner_id,
              owner:profiles!owner_id(
                email,
                telegram_id,
                name
              )
            )
          )
        `)
        .single();

      if (error) throw error;

      // Update booking status
      await supabaseAdmin
        .from('bookings')
        .update({
          status: 'CONFIRMED',
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.booking_id);

      try {
        await syncBookingStatusToConversationChat({
          bookingId: payment.booking_id,
          previousStatus: previousBookingStatus,
          newStatus: 'CONFIRMED',
        });
      } catch (e) {
        console.error('[confirmPayment] chat sync', e);
      }

      // Send notifications
      await NotificationService.dispatch('PAYMENT_CONFIRMED', {
        payment,
        booking: payment.booking,
        listing: payment.booking?.listing,
        partner: payment.booking?.listing?.owner
      });

      return { success: true, payment };
    } catch (error) {
      console.error('[CONFIRM PAYMENT ERROR]', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Admin: Reject payment
   */
  static async rejectPayment(paymentId, reason = '') {
    try {
      const { data: payment, error } = await supabaseAdmin
        .from('payments')
        .update({
          status: PaymentStatus.FAILED,
          metadata: {
            rejected_at: new Date().toISOString(),
            rejection_reason: reason
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, payment };
    } catch (error) {
      console.error('[REJECT PAYMENT ERROR]', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Calculate partner balance
   */
  static async calculatePartnerBalance(partnerId) {
    // Get all completed bookings for partner
    const { data: bookings } = await supabaseAdmin
      .from('bookings')
      .select('price_thb, commission_thb, status')
      .eq('partner_id', partnerId)
      .in('status', ['PAID', 'COMPLETED']);
    
    // Get pending payouts
    const { data: pendingPayouts } = await supabaseAdmin
      .from('payouts')
      .select('amount')
      .eq('partner_id', partnerId)
      .in('status', ['PENDING', 'PROCESSING']);
    
    // Get completed payouts
    const { data: completedPayouts } = await supabaseAdmin
      .from('payouts')
      .select('amount')
      .eq('partner_id', partnerId)
      .eq('status', 'COMPLETED');
    
    let totalEarnings = 0;
    let totalCommission = 0;
    let escrowBalance = 0;
    
    bookings?.forEach(b => {
      const earnings = parseFloat(b.price_thb) - parseFloat(b.commission_thb || 0);
      totalEarnings += earnings;
      totalCommission += parseFloat(b.commission_thb || 0);
      
      // PAID status = in escrow, COMPLETED = available
      if (b.status === 'PAID') {
        escrowBalance += earnings;
      }
    });
    
    const pendingPayoutAmount = pendingPayouts?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;
    const completedPayoutAmount = completedPayouts?.reduce((sum, p) => sum + parseFloat(p.amount), 0) || 0;
    
    const availableBalance = totalEarnings - escrowBalance - pendingPayoutAmount - completedPayoutAmount;
    
    return {
      totalEarnings,
      totalCommission,
      escrowBalance,
      pendingPayouts: pendingPayoutAmount,
      completedPayouts: completedPayoutAmount,
      availableBalance: Math.max(0, availableBalance)
    };
  }
  
  /**
   * Request payout
   */
  static async requestPayout(partnerId, amount, method, details) {
    // Validate balance
    const balance = await this.calculatePartnerBalance(partnerId);
    
    if (amount > balance.availableBalance) {
      return { error: `Insufficient balance. Available: ${balance.availableBalance} THB` };
    }
    
    // Create payout request
    const { data: payout, error } = await supabaseAdmin
      .from('payouts')
      .insert({
        partner_id: partnerId,
        amount,
        currency: 'THB',
        method,
        status: 'PENDING',
        wallet_address: details.walletAddress || null,
        bank_account: details.bankAccount || null
      })
      .select()
      .single();
    
    if (error) {
      return { error: error.message };
    }
    
    return { success: true, payout };
  }
  
  /**
   * Process payout (Admin action)
   */
  static async processPayout(payoutId, transactionId, adminId) {
    // Get payout details
    const { data: payout } = await supabaseAdmin
      .from('payouts')
      .select('*, partner:profiles!partner_id(*)')
      .eq('id', payoutId)
      .single();
    
    if (!payout) {
      return { error: 'Payout not found' };
    }
    
    if (payout.status !== 'PENDING') {
      return { error: `Cannot process payout with status: ${payout.status}` };
    }
    
    // Update payout
    const { error } = await supabaseAdmin
      .from('payouts')
      .update({
        status: 'COMPLETED',
        transaction_id: transactionId,
        processed_at: new Date().toISOString()
      })
      .eq('id', payoutId);
    
    if (error) {
      return { error: error.message };
    }
    
    // Send notification
    await NotificationService.dispatch(NotificationEvents.PAYOUT_PROCESSED, {
      payout: { ...payout, transaction_id: transactionId, status: 'COMPLETED' },
      partner: payout.partner
    });
    
    return { success: true };
  }
  
  /**
   * Reject payout (Admin action)
   */
  static async rejectPayout(payoutId, reason, adminId) {
    const { data: payout } = await supabaseAdmin
      .from('payouts')
      .select('*, partner:profiles!partner_id(*)')
      .eq('id', payoutId)
      .single();
    
    if (!payout) {
      return { error: 'Payout not found' };
    }
    
    const { error } = await supabaseAdmin
      .from('payouts')
      .update({
        status: 'REJECTED',
        rejection_reason: reason,
        processed_at: new Date().toISOString()
      })
      .eq('id', payoutId);
    
    if (error) {
      return { error: error.message };
    }
    
    // Send notification
    await NotificationService.dispatch(NotificationEvents.PAYOUT_REJECTED, {
      payout,
      partner: payout.partner,
      reason
    });
    
    return { success: true };
  }
}

export default PaymentService;
