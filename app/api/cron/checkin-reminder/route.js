/**
 * FunnyRent 2.1 - Check-in Reminder Cron Job
 * POST /api/cron/checkin-reminder
 * 
 * Called at 14:00 on check-in day to send push notification
 * asking guests to "Confirm Arrival"
 * 
 * Vercel Cron: Runs at 07:00 UTC (14:00 Bangkok)
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PushService } from '@/lib/services/push.service';
import { NotificationService } from '@/lib/services/notification.service';

const CRON_SECRET = process.env.CRON_SECRET || 'funnyrent-cron-2026';

export async function POST(request) {
  try {
    // Verify cron secret (supports Vercel cron header)
    const vercelCron = request.headers.get('x-vercel-cron');
    const authHeader = request.headers.get('x-cron-secret') || request.headers.get('authorization');
    
    if (!vercelCron && authHeader !== CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CRON CHECK-IN] Sending check-in reminders...');
    
    // Get today's check-ins with PAID or PAID_ESCROW status
    const today = new Date().toISOString().split('T')[0];
    
    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        guest_name,
        guest_email,
        renter_id,
        check_in,
        listing:listings(id, title)
      `)
      .eq('check_in', today)
      .in('status', ['PAID', 'CONFIRMED']);

    if (error) {
      console.error('[CRON CHECK-IN] Query error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    if (!bookings || bookings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No check-ins today',
        sent: 0
      });
    }

    // Send push notifications
    const results = [];
    for (const booking of bookings) {
      // Send push notification
      const pushResult = await PushService.sendCheckInReminder(booking.id);
      
      // Also send Telegram notification to guest if they have it linked
      await NotificationService.dispatch('CHECKIN_REMINDER', {
        booking,
        listing: booking.listing
      });

      results.push({
        bookingId: booking.id,
        guestName: booking.guest_name,
        listing: booking.listing?.title,
        pushSent: pushResult.success
      });
    }

    const sentCount = results.filter(r => r.pushSent).length;
    console.log(`[CRON CHECK-IN] Sent ${sentCount}/${bookings.length} reminders`);

    return NextResponse.json({
      success: true,
      message: `Sent ${sentCount} check-in reminders`,
      total: bookings.length,
      sent: sentCount,
      results
    });

  } catch (error) {
    console.error('[CRON CHECK-IN ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET for status check
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  
  if (secret !== CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Get today's check-ins
  const today = new Date().toISOString().split('T')[0];
  
  const { data: bookings } = await supabaseAdmin
    .from('bookings')
    .select(`
      id,
      guest_name,
      check_in,
      status,
      listing:listings(id, title)
    `)
    .eq('check_in', today)
    .in('status', ['PAID', 'CONFIRMED']);

  return NextResponse.json({
    success: true,
    message: 'Check-in reminder cron status',
    todayCheckIns: bookings?.length || 0,
    scheduledTime: '14:00 (Asia/Bangkok)',
    bookings: bookings?.map(b => ({
      id: b.id,
      guest: b.guest_name,
      listing: b.listing?.title,
      status: b.status
    }))
  });
}
