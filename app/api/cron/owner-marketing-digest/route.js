/**
 * Weekly Owner Marketing Digest — POST /api/cron/owner-marketing-digest
 * Schedule: Monday 07:00 UTC (vercel.json)
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { runWeeklyOwnerMarketingDigestCron } from '@/lib/services/marketing/owner-marketing-digest.service.js';

async function runAndRespond() {
  const result = await runWeeklyOwnerMarketingDigestCron();
  return NextResponse.json({ success: true, ...result });
}

export async function POST(request) {
  try {
    const denied = assertCronAuthorized(request);
    if (denied) return denied;
    return await runAndRespond();
  } catch (e) {
    console.error('[CRON owner-marketing-digest POST]', e);
    void notifySystemAlert(
      `⏰ <b>Cron: owner-marketing-digest</b>\n<code>${escapeSystemAlertHtml(e?.message || e)}</code>`,
    );
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const denied = assertCronAuthorized(request);
    if (denied) return denied;
    return await runAndRespond();
  } catch (e) {
    console.error('[CRON owner-marketing-digest GET]', e);
    return NextResponse.json({ success: false, error: e?.message || 'error' }, { status: 500 });
  }
}
