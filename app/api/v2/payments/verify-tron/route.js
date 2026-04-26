/**
 * GoStayLo - TRON Transaction Verification API v2.0
 * POST /api/v2/payments/verify-tron
 * GET /api/v2/payments/verify-tron?txid=[TXID]&expectedAmount=[USDT]
 *
 * Ожидаемая сумма USDT: из `bookingId` — **тот же гостевой итог THB**, что и чекаут (`getGuestPayableRoundedThb` + `pricing_snapshot`), Stage 51.0.
 * `expectedAmountThb` без `bookingId` — полный гостевой payable THB (не умножать на «сервисный %» на клиенте).
 */

import { NextResponse } from 'next/server';
import { verifyTronTransaction, getStatusBadge, GOSTAYLO_WALLET, thbToUsdt } from '@/lib/services/tron.service';
import { supabaseAdmin } from '@/lib/supabase';
import { PaymentsV3Service } from '@/lib/services/payments-v3.service';
import { getSessionPayload } from '@/lib/services/session-service';
import { getGuestPayableRoundedThb } from '@/lib/booking-guest-total';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = new Set(['ADMIN', 'MODERATOR']);

/**
 * @param {{ renter_id?: string | null }} booking
 * @param {{ userId?: string | null, role?: string | null } | null} session
 */
function assertBookingTronAmountAccess(booking, session) {
  if (!booking?.renter_id) return { ok: true };
  const uid = session?.userId ? String(session.userId) : '';
  if (!uid) {
    return { ok: false, status: 401, error: 'Authentication required', code: 'UNAUTHORIZED' };
  }
  const role = String(session?.role || '').toUpperCase();
  if (STAFF_ROLES.has(role)) return { ok: true };
  if (String(booking.renter_id) === uid) return { ok: true };
  return { ok: false, status: 403, error: 'Access denied', code: 'FORBIDDEN' };
}

async function resolveExpectedUsdtFromBooking(bookingId) {
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('price_thb, commission_thb, rounding_diff_pot, pricing_snapshot, renter_id')
    .eq('id', bookingId)
    .single();

  if (error || !booking) {
    return { ok: false, error: 'Booking not found', status: 404 };
  }

  const session = await getSessionPayload();
  const gate = assertBookingTronAmountAccess(booking, session);
  if (!gate.ok) {
    return {
      ok: false,
      error: gate.error,
      status: gate.status,
      code: gate.code,
    };
  }

  const totalThb = getGuestPayableRoundedThb(booking);
  if (!Number.isFinite(totalThb) || totalThb <= 0) {
    return { ok: false, error: 'Booking has no payable amount', status: 400 };
  }

  const expectedAmount = await thbToUsdt(totalThb);
  return { ok: true, expectedAmount, guestPayableThb: totalThb };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { txid, bookingId, expectedAmountUsdt, expectedAmountThb } = body;

    if (!txid) {
      return NextResponse.json(
        { success: false, error: 'TXID is required', status: 'INVALID' },
        { status: 400 }
      );
    }

    let expectedAmount = expectedAmountUsdt != null && expectedAmountUsdt !== '' ? parseFloat(expectedAmountUsdt) : null;
    if (expectedAmount != null && !Number.isFinite(expectedAmount)) expectedAmount = null;

    if (bookingId && expectedAmount == null) {
      const resolved = await resolveExpectedUsdtFromBooking(String(bookingId));
      if (!resolved.ok) {
        return NextResponse.json(
          {
            success: false,
            error: resolved.error,
            status: resolved.code || 'ERROR',
          },
          { status: resolved.status || 500 },
        );
      }
      expectedAmount = resolved.expectedAmount;
    }

    if (expectedAmount == null && expectedAmountThb != null && expectedAmountThb !== '') {
      const rawThb = parseFloat(expectedAmountThb);
      if (Number.isFinite(rawThb) && rawThb > 0) {
        expectedAmount = await thbToUsdt(rawThb);
      }
    }

    const result = await verifyTronTransaction(txid, expectedAmount);
    const badge = getStatusBadge(result.status);

    let paymentSettled = null;
    if (bookingId && result.success) {
      const { data: pendingPay } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('booking_id', bookingId)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (pendingPay?.id) {
        const conf = await PaymentsV3Service.confirmPayment(pendingPay.id, {
          source: 'verify_tron_api',
          txid,
          tron: result.data,
        });
        paymentSettled = {
          success: conf?.success === true,
          error: conf?.success ? undefined : conf?.error,
        };
      } else {
        paymentSettled = { success: false, error: 'no_pending_payment' };
      }
    }

    return NextResponse.json({
      success: result.success,
      status: result.status,
      badge,
      data: result.data,
      error: result.error,
      expectedWallet: GOSTAYLO_WALLET,
      paymentSettled,
      amountVerification: result.data
        ? {
            received: result.data.amount,
            expected: result.data.expectedAmount,
            difference: result.data.amountDifference,
            percentage: result.data.amountPercentage,
            status: result.data.amountStatus,
            sufficient: result.data.isAmountSufficient,
          }
        : null,
    });
  } catch (error) {
    console.error('[VERIFY TRON API ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message, status: 'ERROR' },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const txid = searchParams.get('txid');
  const expectedAmountParam = searchParams.get('expectedAmount');
  const bookingId = searchParams.get('bookingId');

  if (!txid) {
    return NextResponse.json({ success: false, error: 'TXID query parameter is required' }, { status: 400 });
  }

  let expectedUsdt =
    expectedAmountParam != null && expectedAmountParam !== '' ? parseFloat(expectedAmountParam) : null;
  if (expectedUsdt != null && !Number.isFinite(expectedUsdt)) expectedUsdt = null;

  if (bookingId && expectedUsdt == null) {
    const resolved = await resolveExpectedUsdtFromBooking(String(bookingId));
    if (!resolved.ok) {
      return NextResponse.json(
        { success: false, error: resolved.error, status: resolved.code || 'ERROR' },
        { status: resolved.status || 500 },
      );
    }
    expectedUsdt = resolved.expectedAmount;
  }

  const result = await verifyTronTransaction(txid, expectedUsdt);
  const badge = getStatusBadge(result.status);

  return NextResponse.json({
    success: result.success,
    status: result.status,
    badge,
    data: result.data,
    error: result.error,
    expectedWallet: GOSTAYLO_WALLET,
    amountVerification: result.data
      ? {
          received: result.data.amount,
          expected: result.data.expectedAmount,
          difference: result.data.amountDifference,
          percentage: result.data.amountPercentage,
          status: result.data.amountStatus,
          sufficient: result.data.isAmountSufficient,
        }
      : null,
  });
}
