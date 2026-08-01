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
import { resolveEscrowThawOps } from '@/lib/ops/ops-job-outcome.js';
import { runStaleCronMonitor } from '@/lib/ops/stale-cron-monitor.js';

export async function POST(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  const run = await startOpsJobRun('escrow-thaw');
  try {
    const result = await EscrowService.processDueEscrowThaws();
    const ops = resolveEscrowThawOps(result);
    await finishOpsJobRun(run, {
      status: ops.status,
      stats: ops.stats,
      errorMessage: ops.errorMessage,
    });
    if (ops.status === 'error') {
      void notifySystemAlert(
        `🧊 <b>Cron: escrow-thaw FAILED</b>\n<code>${escapeSystemAlertHtml(ops.errorMessage)}</code>`,
      );
      // Still check other jobs' freshness (this run was not success).
      void runStaleCronMonitor().catch(() => {});
      return NextResponse.json(
        {
          success: false,
          processed: ops.stats.processed ?? 0,
          error: ops.errorMessage,
        },
        { status: 503 },
      );
    }
    // Hourly path: proactive stale check for money crons (incl. peers).
    void runStaleCronMonitor().catch(() => {});
    return NextResponse.json({
      success: true,
      processed: ops.stats.processed ?? 0,
    });
  } catch (error) {
    void notifySystemAlert(
      `🧊 <b>Cron: escrow-thaw</b>\n<code>${escapeSystemAlertHtml(error?.message || error)}</code>`,
    );
    await finishOpsJobRun(run, { status: 'error', errorMessage: error?.message });
    void runStaleCronMonitor().catch(() => {});
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
