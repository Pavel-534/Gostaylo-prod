/**
 * FunnyRent 2.1 - Payment Service
 * Handles escrow, crypto verification, and payout logic
 */

import { supabaseAdmin } from '@/lib/supabase';
import { NotificationService, NotificationEvents } from './notification.service';

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
    
    if (booking.status !== 'CONFIRMED') {
      return { error: 'Booking must be confirmed before payment' };
    }
    
    // Create payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        booking_id: bookingId,
        amount: booking.price_paid || booking.price_thb,
        currency: currency,
        method: method,
        status: 'PENDING'
      })
      .select()
      .single();
    
    if (paymentError) {
      return { error: paymentError.message };
    }
    
    // Generate payment details based on method
    let paymentDetails = {};
    
    if (method === 'CRYPTO') {
      paymentDetails = {
        walletAddress: 'TXYZMockTokenAddress1234567890abc', // Replace with real wallet
        network: 'TRC-20',
        currency: 'USDT',
        amount: booking.price_thb / 35.5, // Convert to USDT
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min expiry
      };
    } else if (method === 'CARD') {
      paymentDetails = {
        // Stripe session would be created here
        redirectUrl: `/checkout/${bookingId}/pay`
      };
    } else if (method === 'MIR') {
      paymentDetails = {
        // MIR payment gateway details
        redirectUrl: `/checkout/${bookingId}/pay-mir`
      };
    }
    
    return {
      success: true,
      payment: {
        ...payment,
        details: paymentDetails
      }
    };
  }
  
  /**
   * Verify crypto payment (USDT TRC-20)
   */
  static async verifyCryptoPayment(bookingId, txId, expectedAmount) {
    // Get payment record
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('booking_id', bookingId)
      .single();
    
    if (!payment) {
      return { error: 'Payment not found' };
    }
    
    // Mock TRON verification (replace with real TronGrid API)
    const verificationResult = await this.mockVerifyTronTransaction(txId, expectedAmount);
    
    if (!verificationResult.success) {
      return { error: verificationResult.error };
    }
    
    // Update payment status
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'COMPLETED',
        tx_id: txId,
        completed_at: new Date().toISOString(),
        metadata: { verification: verificationResult }
      })
      .eq('id', payment.id);
    
    if (updateError) {
      return { error: updateError.message };
    }
    
    // Update booking to PAID
    await supabaseAdmin
      .from('bookings')
      .update({ status: 'PAID' })
      .eq('id', bookingId);
    
    // Get full booking for notification
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select(`
        *,
        listings(title),
        renter:profiles!renter_id(id, email, first_name)
      `)
      .eq('id', bookingId)
      .single();
    
    // Send notification
    if (booking) {
      await NotificationService.dispatch(NotificationEvents.PAYMENT_RECEIVED, {
        booking,
        payment: { ...payment, status: 'COMPLETED' },
        renter: booking.renter,
        listing: booking.listings
      });
    }
    
    return { success: true, verified: true };
  }
  
  /**
   * Mock TRON transaction verification
   */
  static async mockVerifyTronTransaction(txId, expectedAmount) {
    // In production, use TronGrid API:
    // const response = await fetch(`https://api.trongrid.io/v1/transactions/${txId}`);
    
    console.log(`[CRYPTO] Verifying TXID: ${txId} for amount: ${expectedAmount} USDT`);
    
    // Mock verification - always returns success for valid-looking TXIDs
    if (txId && txId.length >= 10) {
      return {
        success: true,
        txId,
        amount: expectedAmount,
        confirmations: 19,
        timestamp: new Date().toISOString()
      };
    }
    
    return { success: false, error: 'Invalid transaction ID' };
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
      const earnings = parseFloat(b.price_thb) - parseFloat(b.commission_thb);
      totalEarnings += earnings;
      totalCommission += parseFloat(b.commission_thb);
      
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
    
    // Update partner's available balance
    await supabaseAdmin
      .from('profiles')
      .update({
        available_balance: supabaseAdmin.raw(`available_balance - ${payout.amount}`)
      })
      .eq('id', payout.partner_id);
    
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
