import { NextResponse } from 'next/server';
import { getSessionPayload } from '@/lib/services/session-service';
import { supabaseAdmin } from '@/lib/supabase';
import {
  bindReferralCodeToCampaign,
  listActiveReferralCampaigns,
} from '@/lib/services/marketing/referral-campaigns.service.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getSessionPayload();
  if (!session?.userId) return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401 });
  const { data: codeRow } = await supabaseAdmin
    .from('referral_codes')
    .select('id,code,campaign_slug')
    .eq('user_id', session.userId)
    .maybeSingle();
  const campaigns = await listActiveReferralCampaigns();
  return NextResponse.json({
    success: true,
    data: {
      referralCodeId: codeRow?.id || null,
      referralCode: codeRow?.code || null,
      campaignSlug: codeRow?.campaign_slug || null,
      campaigns: campaigns.map((x) => ({ slug: x.slug, name: x.name })),
    },
  });
}

export async function PATCH(request) {
  const session = await getSessionPayload();
  if (!session?.userId) return NextResponse.json({ success: false, error: 'AUTH_REQUIRED' }, { status: 401 });
  const { data: codeRow } = await supabaseAdmin
    .from('referral_codes')
    .select('id')
    .eq('user_id', session.userId)
    .maybeSingle();
  if (!codeRow?.id) return NextResponse.json({ success: false, error: 'REFERRAL_CODE_NOT_FOUND' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  try {
    const data = await bindReferralCodeToCampaign({
      codeId: codeRow.id,
      campaignSlug: body?.campaignSlug || null,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_CAMPAIGN_BIND_FAILED' },
      { status: 400 },
    );
  }
}

