import { NextResponse } from 'next/server';
import { rateLimitCheck } from '@/lib/rate-limit';
import ReferralAttributionService from '@/lib/referral/attribution.service.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v2/referral/track?code=AIR-XXX&utm_source=...&path=/...
 * Public click tracking — sets HttpOnly cookie gostaylo_ref (last-touch 7d).
 */
export async function GET(request) {
  const rl = await rateLimitCheck(request, 'referral_track');
  if (rl) {
    return NextResponse.json(rl.body, { status: rl.status, headers: rl.headers });
  }

  const { searchParams } = new URL(request.url);
  const code = String(searchParams.get('code') || searchParams.get('ref') || '').trim();
  const landingPath = String(searchParams.get('path') || searchParams.get('landing') || '').trim();
  const utmSource = String(searchParams.get('utm_source') || '').trim();
  const utmMedium = String(searchParams.get('utm_medium') || '').trim();
  const utmCampaign = String(searchParams.get('utm_campaign') || '').trim();
  const fingerprint = String(
    searchParams.get('fingerprint') || request.headers.get('x-referral-fingerprint') || '',
  ).trim();

  if (!code) {
    return NextResponse.json(
      { success: false, error_code: 'REFERRAL_CODE_REQUIRED' },
      { status: 400 },
    );
  }

  const result = await ReferralAttributionService.recordClick({
    request,
    code,
    landingPath: landingPath || null,
    utmSource: utmSource || null,
    utmMedium: utmMedium || null,
    utmCampaign: utmCampaign || null,
    fingerprint: fingerprint || null,
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error_code: result.error || 'REFERRAL_TRACK_FAILED',
      },
      { status: result.status || 400 },
    );
  }

  const headers = new Headers();
  if (result.data?.setCookie) {
    headers.append('Set-Cookie', result.data.setCookie);
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        clickId: result.data.clickId,
        referralCode: result.data.referralCode,
      },
    },
    { status: 200, headers },
  );
}
