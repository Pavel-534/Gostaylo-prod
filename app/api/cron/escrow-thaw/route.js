/**
 * POST /api/cron/escrow-thaw
 * PAID_ESCROW → THAWED when escrow_thaw_at <= now (category rules in lib/escrow-thaw-rules.js).
 * Replaces automatic bank payout: partners withdraw via Request Payout only.
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import EscrowService from '@/lib/services/escrow.service';
import { notifySystemAlert, escapeSystemAlertHtml } from '@/lib/services/system-alert-notify.js';
import { startOpsJobRun, finishOpsJobRun } from '@/lib/ops-job-runs';
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js';

export async function POST(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  const run = await startOpsJobRun('escrow-thaw');
  try {
    const result = await EscrowService.processDueEscrowThaws();
    await finishOpsJobRun(run, {
      status: 'success',
      stats: { processed: result.processed ?? 0 },
    });
    return NextResponse.json({
      success: result.success !== false,
      processed: result.processed ?? 0,
      error: result.error,
    });
  } catch (error) {
    void notifySystemAlert(
      `🧊 <b>Cron: escrow-thaw</b>\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    );
    await finishOpsJobRun(run, { status: 'error', errorMessage: error?.message });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  return NextResponse.json({
    success: true,
    message: 'Escrow thaw cron — moves PAID_ESCROW → THAWED when due',
  });
}
