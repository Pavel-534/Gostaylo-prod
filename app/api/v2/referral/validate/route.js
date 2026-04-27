import { NextResponse } from 'next/server';
import ReferralGuardService from '@/lib/services/marketing/referral-guard.service';
import { rateLimitCheck } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const rl = rateLimitCheck(request, 'promo_validate');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const code = String(body?.code || '').trim();
  const email = String(body?.email || '').trim();
  const fingerprint = String(body?.fingerprint || '').trim();
  if (!code) {
    return NextResponse.json({ success: false, error: 'REFERRAL_CODE_REQUIRED' }, { status: 400 });
  }

  const guard = await ReferralGuardService.validateActivation({
    code,
    candidateEmail: email || null,
    request,
    fingerprint: fingerprint || null,
  });
  if (!guard.success) {
    return NextResponse.json(
      { success: false, valid: false, error: guard.error, data: guard.data || null },
      { status: guard.status || 400 },
    );
  }

  return NextResponse.json({
    success: true,
    valid: true,
    data: {
      code: guard.data.code,
      referrerId: guard.data.referrerId,
    },
  });
}

