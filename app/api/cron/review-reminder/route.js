/**
 * GET | POST /api/cron/review-reminder
 * Next calendar day after check_out (listing TZ): remind guest to leave a review.
 *
 * Vercel Cron: e.g. 08:00 UTC (~15:00 Bangkok) — same auth pattern as other crons.
 *
 * Внешние планировщики (cron-job.org): **канонический хост без www** (`https://gostaylo.com/...`).
 * Авторизация: `Authorization: Bearer <CRON_SECRET>` (токен без лишних пробелов) или `x-cron-secret: <CRON_SECRET>`.
 * **GET и POST** при успешной авторизации выполняют одну и ту же рассылку (удобно, если планировщик шлёт только GET).
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { PushService } from '@/lib/services/push.service';
import { NotificationService } from '@/lib/services/notification.service';
import { listingDateToday, addListingDays, toListingDate } from '@/lib/listing-date';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js';

const ELIGIBLE_STATUSES = ['PAID_ESCROW', 'CHECKED_IN', 'THAWED', 'COMPLETED'];

async function runReviewReminderJob() {
  const yesterday = addListingDays(listingDateToday(), -1);

  const { data: rawBookings, error } = await supabaseAdmin
    .from('bookings')
    .select(
      `
        id,
        renter_id,
        status,
        metadata,
        check_out,
        renter:profiles!renter_id(id, telegram_id),
        listing:listings(id, title, category_id)
      `,
    )
    .in('status', ELIGIBLE_STATUSES)
    .not('renter_id', 'is', null);

  if (error) {
    console.error('[CRON REVIEW] Query error:', error);
    void notifySystemAlert(
      `⭐ <b>Cron: review-reminder</b> — ошибка запроса БД\n<code>${escapeSystemAlertHtml(error.message)}</code>`,
    );
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  const bookings = (rawBookings || []).filter((b) => toListingDate(b.check_out) === yesterday);

  if (!bookings?.length) {
    return NextResponse.json({
      success: true,
      message: 'No bookings for review reminder',
      sent: 0,
      targetCheckOut: yesterday,
    });
  }

  const ids = bookings.map((b) => b.id);
  let reviewedIds = new Set();
  const { data: existingReviews, error: revErr } = await supabaseAdmin
    .from('reviews')
    .select('booking_id')
    .in('booking_id', ids);

  if (revErr && !String(revErr.message || '').includes('reviews')) {
    console.error('[CRON REVIEW] reviews query:', revErr);
  } else if (!revErr) {
    reviewedIds = new Set((existingReviews || []).map((r) => r.booking_id).filter(Boolean));
  }

  const results = [];
  for (const booking of bookings) {
    if (reviewedIds.has(booking.id)) continue;
    const meta = booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {};
    if (meta.review_reminder_sent_at) continue;

    const pushResult = await PushService.sendReviewReminder(booking.id);

    await NotificationService.dispatch('REVIEW_REMINDER', {
      booking: { ...booking, renter: booking.renter },
      listing: booking.listing,
    });

    const sentAt = new Date().toISOString();
    await supabaseAdmin
      .from('bookings')
      .update({
        metadata: { ...meta, review_reminder_sent_at: sentAt },
      })
      .eq('id', booking.id);

    results.push({
      bookingId: booking.id,
      pushSent: pushResult.success,
    });
  }

  const sentCount = results.filter((r) => r.pushSent).length;
  console.log(`[CRON REVIEW] Sent ${sentCount}/${results.length} reminders (eligible ${bookings.length})`);

  return NextResponse.json({
    success: true,
    message: `Sent ${sentCount} review reminders`,
    targetCheckOut: yesterday,
    total: results.length,
    sent: sentCount,
    results,
  });
}

export async function POST(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    return await runReviewReminderJob();
  } catch (error) {
    console.error('[CRON REVIEW ERROR]', error);
    void notifySystemAlert(
      `⭐ <b>Cron: review-reminder</b> — исключение\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    );
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    return await runReviewReminderJob();
  } catch (error) {
    console.error('[CRON REVIEW ERROR]', error);
    void notifySystemAlert(
      `⭐ <b>Cron: review-reminder</b> — исключение\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    );
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
