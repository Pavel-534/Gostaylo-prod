/**
 * Legacy automatic payout cron — DISABLED (PR-#2).
 * Use POST /api/cron/escrow-thaw for PAID_ESCROW→THAWED; partner withdraws via Request Payout.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { EscrowService } from '@/lib/services/escrow.service';

const CRON_SECRET = process.env.CRON_SECRET;

function authorize(request) {
  if (!CRON_SECRET) return false;
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');
  return authHeader === `Bearer ${CRON_SECRET}` || cronHeader === CRON_SECRET;
}

export async function POST(request) {
  if (!authorize(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  console.warn('[CRON PAYOUT] disabled — use escrow-thaw + partner Request Payout');
  return NextResponse.json(
    {
      success: false,
      disabled: true,
      message:
        'Automatic payouts are disabled. Funds move PAID_ESCROW→THAWED via /api/cron/escrow-thaw; withdrawals via Request Payout only.',
    },
    { status: 503 },
  );
}

export async function GET(request) {
  if (!authorize(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  if (action === 'preview-thaw') {
    const result = await EscrowService.notifyUpcomingThaw();
    return NextResponse.json({
      success: true,
      message: 'Upcoming thaw preview (legacy helper)',
      ...result,
    });
  }

  const { bookings } = await EscrowService.getPayoutReadyBookings();
  const upcoming = await EscrowService.getUpcomingThawBookings();
  const policy = await EscrowService.getSettlementPolicy();

  return NextResponse.json({
    success: true,
    message: 'Legacy payout cron is disabled; see escrow-thaw',
    disabled: true,
    rule: `Settlement policy (metadata): delayDays=${policy.delayDays}, payoutHourLocal=${policy.payoutHourLocal}`,
    readyForPayoutLegacy: {
      count: bookings?.length || 0,
      bookings: bookings?.map((b) => ({
        id: b.id,
        checkIn: b.check_in,
        netAmount: b.net_amount_thb,
        listing: b.listing?.title,
      })),
    },
    upcomingThaw: {
      count: upcoming.bookings?.length || 0,
      bookings: upcoming.bookings?.map((b) => ({
        id: b.id,
        checkIn: b.check_in,
        listing: b.listing?.title,
      })),
    },
  });
}
