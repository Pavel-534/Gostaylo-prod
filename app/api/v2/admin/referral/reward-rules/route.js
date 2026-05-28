import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import FinancialReportingService from '@/lib/finance/reporting.service.js';
import {
  listReferralRewardRules,
  upsertReferralRewardRule,
} from '@/lib/services/marketing/referral-reward-rules.service.js';
import { listReferralCampaigns } from '@/lib/services/marketing/referral-campaigns.service.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const { searchParams } = new URL(request.url);
    const includeStats = searchParams.get('includeStats') === '1';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const rules = await listReferralRewardRules();
    const campaigns = await listReferralCampaigns();
    const campaignOptions = campaigns.map((x) => x.slug).filter(Boolean);
    let stats = null;
    if (includeStats) {
      stats = await FinancialReportingService.buildRewardRuleAbStats({
        fromIso: dateFrom || undefined,
        toIso: dateTo || undefined,
      });
    }
    return NextResponse.json({ success: true, data: rules, stats, campaignOptions });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REWARD_RULES_LIST_FAILED' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const body = await request.json();
    const profile = access.profile || {};
    const row = await upsertReferralRewardRule({
      ...body,
      createdBy: profile.id,
    });
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REWARD_RULE_UPSERT_FAILED' },
      { status: 400 },
    );
  }
}
