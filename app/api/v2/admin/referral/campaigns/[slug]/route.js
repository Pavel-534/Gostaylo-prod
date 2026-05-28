import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import FinancialReportingService from '@/lib/finance/reporting.service.js';
import {
  buildReferralCampaignDrilldown,
  normalizeCampaignSlug,
  setReferralCampaignState,
  topUpReferralCampaignBudget,
  upsertReferralCampaign,
} from '@/lib/services/marketing/referral-campaigns.service.js';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const slug = normalizeCampaignSlug(params?.slug);
    if (!slug) {
      return NextResponse.json({ success: false, error: 'CAMPAIGN_SLUG_REQUIRED' }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom') || null;
    const dateTo = searchParams.get('dateTo') || null;
    const format = String(searchParams.get('format') || '').toLowerCase();
    const data = await buildReferralCampaignDrilldown({ slug, fromIso: dateFrom, toIso: dateTo });
    if (format === 'csv') {
      const csv = FinancialReportingService.buildCampaignDetailCsv(data);
      const fromKey = (dateFrom || 'start').slice(0, 10);
      const toKey = (dateTo || 'end').slice(0, 10);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="referral-campaign_${slug}_${fromKey}_${toKey}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const status = String(error?.message || '').includes('NOT_FOUND') ? 404 : 500;
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_CAMPAIGN_DETAIL_FAILED' },
      { status },
    );
  }
}

export async function PATCH(request, { params }) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const slug = normalizeCampaignSlug(params?.slug);
    const body = await request.json();
    if (!slug) return NextResponse.json({ success: false, error: 'CAMPAIGN_SLUG_REQUIRED' }, { status: 400 });
    if (String(body?.action || '').trim() === 'top_up_budget') {
      const profile = access.profile || {};
      const adminName = [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim();
      const row = await topUpReferralCampaignBudget({
        slug,
        addThb: body?.addThb,
        adminUserId: profile.id,
        adminEmail: profile.email,
        adminName: adminName || profile.email || profile.id,
        comment: body?.comment,
      });
      return NextResponse.json({ success: true, data: row });
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'isActive') && Object.keys(body || {}).length <= 2) {
      const row = await setReferralCampaignState(slug, body?.isActive !== false);
      return NextResponse.json({ success: true, data: row });
    }
    const row = await upsertReferralCampaign({ ...(body || {}), slug });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_CAMPAIGN_PATCH_FAILED' },
      { status: 400 },
    );
  }
}
