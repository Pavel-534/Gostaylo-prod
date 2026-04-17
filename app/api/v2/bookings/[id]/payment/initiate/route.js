/**
 * POST /api/bookings/[id]/payment/initiate
 * Initialize a payment for a booking
 * SECURITY: Verifies booking ownership (renter_id must match session)
 */

import { NextResponse } from 'next/server';
import { getUserIdFromSession } from '@/lib/services/session-service';
import { resolveThbPerUsdt } from '@/lib/services/currency.service';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';

export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Official GoStayLo USDT TRC-20 Wallet Address
const TRON_WALLET_ADDRESS = 'TXyfMKVxUNFkC8Q77GnbAqgnWFUWVaKwZ5';

export async function POST(request, { params }) {
  const bookingId = params.id;
  
  if (!bookingId) {
    return NextResponse.json({ success: false, error: 'Booking ID required' }, { status: 400 });
  }
  
  try {
    const body = await request.json();
    const { method } = body;
    
    if (!method || !['CARD', 'MIR', 'CRYPTO'].includes(method)) {
      return NextResponse.json({ success: false, error: 'Invalid payment method' }, { status: 400 });
    }
    
    // Fetch booking
    const bookingRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        }
      }
    );
    
    const bookings = await bookingRes.json();
    
    if (!bookings || bookings.length === 0) {
      return NextResponse.json({ success: false, error: 'Booking not found' }, { status: 404 });
    }
    
    const booking = bookings[0];

    // Ownership check: only the renter can pay for their booking
    const sessionUserId = await getUserIdFromSession();
    if (booking.renter_id) {
      if (!sessionUserId) {
        return NextResponse.json({ success: false, error: 'Please log in to complete payment' }, { status: 401 });
      }
      if (booking.renter_id !== sessionUserId) {
        return NextResponse.json({ success: false, error: 'Access denied. This is not your booking.' }, { status: 403 });
      }
    }
    
    if (booking.status === 'CANCELLED') {
      return NextResponse.json({ success: false, error: 'Booking is cancelled' }, { status: 400 });
    }
    
    // Allow payment for PENDING, AWAITING_PAYMENT, CONFIRMED bookings
    // Remove restriction for CONFIRMED - user might want to see payment details
    
    // Calculate amounts from booking snapshot:
    // price_thb = subtotal after discounts, commission_thb = guest service fee.
    const priceThb = parseFloat(booking.price_thb);
    const serviceFee = parseFloat(booking.commission_thb) || 0;
    const totalThb = priceThb + serviceFee;
    const usdtRate = await resolveThbPerUsdt();
    const totalUsdt = (totalThb / usdtRate).toFixed(2);
    
    // Generate payment details
    const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    let paymentData = {
      id: paymentId,
      bookingId,
      method,
      status: 'PENDING',
      amountThb: totalThb,
      currency: 'THB',
      createdAt: new Date().toISOString()
    };
    
    if (method === 'CRYPTO') {
      paymentData.metadata = {
        walletAddress: TRON_WALLET_ADDRESS,
        network: 'TRC-20',
        amount: totalUsdt,
        currency: 'USDT',
        exchangeRate: usdtRate,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min expiry
      };
    } else if (method === 'CARD' || method === 'MIR') {
      paymentData.metadata = {
        gateway: method === 'MIR' ? 'RU_GATEWAY' : 'STRIPE',
        checkoutUrl: `https://checkout.stripe.com/mock/${paymentId}`,
        amountThb: totalThb
      };
    }
    
    // Update booking status to AWAITING_PAYMENT
    const patchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: 'AWAITING_PAYMENT',
          metadata: {
            ...booking.metadata,
            paymentId,
            paymentMethod: method,
            paymentInitiatedAt: new Date().toISOString()
          }
        })
      }
    );

    if (!patchRes.ok) {
      const patchBody = await patchRes.text().catch(() => '')
      void notifySystemAlert(
        `💳 <b>Платёж: не удалось обновить бронь при инициализации</b>\n` +
          `booking: <code>${escapeSystemAlertHtml(bookingId)}</code>\n` +
          `method: <code>${escapeSystemAlertHtml(method)}</code>\n` +
          `<code>${escapeSystemAlertHtml(patchBody.slice(0, 800))}</code>`,
      )
      return NextResponse.json(
        { success: false, error: 'Payment gateway bookkeeping failed' },
        { status: 502 },
      )
    }
    
    return NextResponse.json({
      success: true,
      data: paymentData
    });
    
  } catch (error) {
    console.error('[PAYMENT-INITIATE ERROR]', error);
    void notifySystemAlert(
      `💳 <b>Платёж: критическая ошибка initiate</b>\n` +
        `booking: <code>${escapeSystemAlertHtml(bookingId)}</code>\n` +
        `<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    )
    return NextResponse.json({ success: false, error: 'Failed to initiate payment' }, { status: 500 });
  }
}
