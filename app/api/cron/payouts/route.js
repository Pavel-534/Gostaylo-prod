/**
 * GoStayLo - Payout Cron Job API
 * POST /api/cron/payouts
 * 
 * 24H ESCROW RULE:
 * Called at 18:00 local time to process payouts for bookings
 * where check-in was YESTERDAY (24h protection buffer)
 * 
 * Vercel Cron: Runs at 11:00 UTC (18:00 Bangkok)
 * Requires CRON_SECRET header for security
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { EscrowService } from '@/lib/services/escrow.service';
import { NotificationService } from '@/lib/services/notification.service';

// Security - check Vercel cron header or custom secret
const CRON_SECRET = process.env.CRON_SECRET || 'gostaylo-cron-2026';

// Telegram admin topic for payout notifications
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_ADMIN_GROUP = process.env.TELEGRAM_ADMIN_GROUP_ID;
const FINANCE_TOPIC_ID = 16;

export async function POST(request) {
  try {
    // Verify cron secret (supports Vercel cron header)
    const vercelCron = request.headers.get('x-vercel-cron');
    const authHeader = request.headers.get('x-cron-secret') || request.headers.get('authorization');
    
    // Allow if Vercel cron header is present OR valid secret
    if (!vercelCron && authHeader !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CRON PAYOUT] Starting daily payout processing (24H Rule)...');
    
    // Process all payouts (bookings with check-in YESTERDAY)
    const result = await EscrowService.processAllPayoutsForToday();

    // Notify admin group (Thread 16 - FINANCE) about thawed payouts
    if (result.processed > 0 && TELEGRAM_BOT_TOKEN && TELEGRAM_ADMIN_GROUP) {
      const thawedList = result.results
        .filter(r => r.success)
        .map(r => `• ${r.listingTitle}: ฿${r.amount?.toLocaleString() || 0}`)
        .join('\n');

      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_ADMIN_GROUP,
          message_thread_id: FINANCE_TOPIC_ID,
          text: `💰 <b>ESCROW THAWED (24H Rule)</b>\n\n` +
                `✅ Processed: ${result.processed}/${result.total} payouts\n\n` +
                `${thawedList}\n\n` +
                `📅 Check-in was yesterday, funds released to partners.\n` +
                `🕐 ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })}`,
          parse_mode: 'HTML'
        })
      });
    }

    return NextResponse.json({
      success: result.success,
      message: `Processed ${result.processed || 0} of ${result.total || 0} payouts (24H Rule)`,
      rule: 'Payouts released 24 hours after check-in',
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

// GET for manual trigger and status check (debug only)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const action = searchParams.get('action');
  
  if (secret !== CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Preview tomorrow's thaw
  if (action === 'preview-thaw') {
    const result = await EscrowService.notifyUpcomingThaw();
    return NextResponse.json({
      success: true,
      message: 'Upcoming thaw preview',
      ...result
    });
  }

  // Get current queue (check-in was yesterday or earlier)
  const { bookings } = await EscrowService.getPayoutReadyBookings();
  
  // Get upcoming (check-in today, will thaw tomorrow)
  const upcoming = await EscrowService.getUpcomingThawBookings();

  return NextResponse.json({
    success: true,
    message: 'Payout cron status (24H Rule)',
    rule: 'Payouts released at 18:00, 24 hours after check-in',
    readyForPayout: {
      count: bookings?.length || 0,
      note: 'Check-in was yesterday, ready to process now',
      bookings: bookings?.map(b => ({
        id: b.id,
        checkIn: b.check_in,
        amount: b.price_thb,
        netAmount: b.net_amount_thb,
        listing: b.listing?.title
      }))
    },
    upcomingThaw: {
      count: upcoming.bookings?.length || 0,
      note: 'Check-in today, will thaw tomorrow at 18:00',
      bookings: upcoming.bookings?.map(b => ({
        id: b.id,
        checkIn: b.check_in,
        amount: b.net_amount_thb,
        listing: b.listing?.title
      }))
    }
  });
}
