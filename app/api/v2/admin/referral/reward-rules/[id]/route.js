import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import {
  getReferralRewardRuleById,
  setReferralRewardRuleActive,
  upsertReferralRewardRule,
} from '@/lib/services/marketing/referral-reward-rules.service.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const id = String(params?.id || '').trim();
    const row = await getReferralRewardRuleById(id);
    if (!row) {
      return NextResponse.json({ success: false, error: 'RULE_NOT_FOUND' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REWARD_RULE_READ_FAILED' },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const id = String(params?.id || '').trim();
    const body = await request.json();
    if (body?.isActive != null && Object.keys(body).length <= 2) {
      const row = await setReferralRewardRuleActive(id, body.isActive);
      return NextResponse.json({ success: true, data: row });
    }
    const row = await upsertReferralRewardRule({ ...body, id });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REWARD_RULE_PATCH_FAILED' },
      { status: 400 },
    );
  }
}
