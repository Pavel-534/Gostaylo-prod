/**
 * GET/POST /api/cron/referral-unlock — release earned_held referral bonuses (Stage 121.1).
 */
import { NextResponse } from 'next/server';
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js';
import { executeReferralUnlockRun } from '@/lib/cron/referral-unlock-run.js';
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs';

export const dynamic = 'force-dynamic';

async function handle(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const run = await startOpsJobRun('referral-unlock');
  try {
    const url = new URL(request.url);
    const dryRun = url.searchParams.get('dryRun') === '1' || url.searchParams.get('dryRun') === 'true';
    const limit = Number(url.searchParams.get('limit') || 200);
    const exec = await executeReferralUnlockRun({ dryRun, limit, trigger: 'cron' });
    if (!exec.success) {
      await finishOpsJobRun(run, { status: 'error', errorMessage: exec.error });
      return NextResponse.json(
        { success: false, error: exec.error, ...(exec.result || {}) },
        { status: 500 },
      );
    }
    await finishOpsJobRun(run, { status: 'success', stats: exec.result || {} });
    return NextResponse.json({ success: true, ...exec.result });
  } catch (e) {
    await finishOpsJobRun(run, { status: 'error', errorMessage: e?.message });
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
