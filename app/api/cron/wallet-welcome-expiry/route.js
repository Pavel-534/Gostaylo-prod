/**
 * GET/POST /api/cron/wallet-welcome-expiry — welcome bonus expiry + reminder triggers (Stage 71.6).
 */
import { NextResponse } from 'next/server';
import { assertCronAuthorized } from '@/lib/cron/verify-cron-secret.js';
import { runWalletWelcomeBonusCron } from '@/lib/services/finance/wallet-expiry.service.js';

export const dynamic = 'force-dynamic';

async function handle(request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;
  try {
    const result = await runWalletWelcomeBonusCron();
    return NextResponse.json({ success: true, ...result });
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
