/**
 * GoStayLo - Check-in Reminder Cron Job
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
import { listingDateToday, toListingDate } from '@/lib/listing-date';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js';

export async function POST(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  try {
    console.log('[CRON CHECK-IN] Sending check-in reminders...');
    
    // Today's check-ins — only bookings with funds in escrow (paid on platform)
    const today = listingDateToday();
    
    const { data: rawBookings, error } = await supabaseAdmin
      .from('bookings')
      .select(`
        id,
        guest_name,
        guest_email,
        renter_id,
        check_in,
        renter:profiles!renter_id(id, telegram_id),
        listing:listings(id, title, category_id)
      `)
      .eq('status', 'PAID_ESCROW');

    if (error) {
      console.error('[CRON CHECK-IN] Query error:', error);
      void notifySystemAlert(
        `⏰ <b>Cron: checkin-reminder</b> — ошибка запроса БД\n<code>${escapeSystemAlertHtml(error.message)}</code>`,
      )
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    const bookings = (rawBookings || []).filter((b) => toListingDate(b.check_in) === today);

    if (!bookings.length) {
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
        booking: { ...booking, renter: booking.renter },
        listing: booking.listing,
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
    void notifySystemAlert(
      `⏰ <b>Cron: checkin-reminder</b> — исключение\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    )
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET for status check
export async function GET(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  // Get today's check-ins
  const today = listingDateToday();
  
  const { data: rawBookings } = await supabaseAdmin
    .from('bookings')
    .select(`
      id,
      guest_name,
      check_in,
      status,
      listing:listings(id, title)
    `)
    .eq('status', 'PAID_ESCROW');

  const bookings = (rawBookings || []).filter((b) => toListingDate(b.check_in) === today);

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
