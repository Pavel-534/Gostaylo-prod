/**
 * GET/POST /api/cron/referral-unlock — release earned_held referral bonuses (Stage 121.1).
 */
import { NextResponse } from 'next/server';
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js';
import { runReferralUnlockJob } from '@/lib/cron/referral-unlock-job.js';

export const dynamic = 'force-dynamic';

async function handle(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true';
    const limit = Number(url.searchParams.get('limit') || 200);
    const result = await runReferralUnlockJob({ dryRun, limit });
    return NextResponse.json({ success: result.success !== false, ...result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'Internal error' },
      { status: 500 },
    );
  }
}

export async function GET(request) {
  return handle(request);
}

export async function POST(request) {
  return handle(request);
}
