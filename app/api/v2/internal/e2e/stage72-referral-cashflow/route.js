/**
 * POST /api/v2/internal/e2e/stage72-referral-cashflow
 * Stage 72.4 — полный прогон симуляции реферального cashflow (5 пользователей, 2 брони).
 *
 * Header: x-e2e-fixture-secret: <E2E_FIXTURE_SECRET>
 */

import { NextResponse } from 'next/server';
import { runStage72ReferralCashflowFixture } from '@/lib/e2e/stage72-referral-cashflow-fixture';

export const dynamic = 'force-dynamic';

function getSecret() {
  return String(process.env.E2E_FIXTURE_SECRET || '').trim();
}

export async function POST(request) {
  const expected = getSecret();
  if (!expected) {
    return NextResponse.json({ success: false, error: 'Fixture API disabled' }, { status: 404 });
  }

  const hdr = request.headers.get('x-e2e-fixture-secret') || '';
  if (hdr !== expected) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runStage72ReferralCashflowFixture();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e?.message || String(e);
    console.error('[e2e/stage72-referral-cashflow]', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
