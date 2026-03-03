/**
 * FunnyRent 2.1 - Payout Cron Job API
 * POST /api/cron/payouts
 * 
 * Called at 18:00 local time to process payouts for check-in day bookings
 * Requires CRON_SECRET header for security
 */

import { NextResponse } from 'next/server';
import { EscrowService } from '@/lib/services/escrow.service';

// Simple security - in production use proper cron authentication
const CRON_SECRET = process.env.CRON_SECRET || 'funnyrent-cron-2026';

export async function POST(request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('x-cron-secret') || request.headers.get('authorization');
    if (authHeader !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CRON PAYOUT] Starting daily payout processing...');
    
    // Process all payouts for today
    const result = await EscrowService.processAllPayoutsForToday();

    return NextResponse.json({
      success: result.success,
      message: `Processed ${result.processed || 0} of ${result.total || 0} payouts`,
      timestamp: new Date().toISOString(),
      results: result.results
    });

  } catch (error) {
    console.error('[CRON PAYOUT ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET for manual trigger (debug only)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get bookings ready for payout
  const { bookings } = await EscrowService.getPayoutReadyBookings();

  return NextResponse.json({
    success: true,
    message: 'Payout cron status',
    bookingsReadyForPayout: bookings?.length || 0,
    bookings: bookings?.map(b => ({
      id: b.id,
      checkIn: b.check_in,
      amount: b.price_thb,
      listing: b.listing?.title
    }))
  });
}
