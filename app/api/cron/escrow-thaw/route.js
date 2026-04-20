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

const CRON_SECRET = process.env.CRON_SECRET;

function authorize(request) {
  if (!CRON_SECRET) return false;
  const authHeader = request.headers.get('authorization');
  const cronHeader = request.headers.get('x-cron-secret');
  return authHeader === `Bearer ${CRON_SECRET}` || cronHeader === CRON_SECRET;
}

export async function POST(request) {
  if (!authorize(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
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
  if (!authorize(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({
    success: true,
    message: 'Escrow thaw cron — moves PAID_ESCROW → THAWED when due',
  });
}
