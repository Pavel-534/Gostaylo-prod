import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import { supabaseAdmin } from '@/lib/supabase';
import FinancialReportingService from '@/lib/finance/reporting.service.js';
import {
  bindReferralCodeToCampaign,
  listReferralCampaigns,
  upsertReferralCampaign,
} from '@/lib/services/marketing/referral-campaigns.service.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const { searchParams } = new URL(request.url);
    const format = String(searchParams.get('format') || '').toLowerCase();
    const rows = await listReferralCampaigns();
    if (format === 'csv') {
      const csv = FinancialReportingService.buildCampaignsListCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="referral-campaigns.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }
    const includeCodes = searchParams.get('includeCodes') === '1';
    if (!includeCodes) return NextResponse.json({ success: true, data: rows });
    const { data: codes } = await supabaseAdmin
      .from('referral_codes')
      .select('id,code,campaign_slug,is_active,user_id')
      .order('created_at', { ascending: false })
      .limit(250);
    return NextResponse.json({ success: true, data: rows, codes: Array.isArray(codes) ? codes : [] });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_CAMPAIGNS_LIST_FAILED' },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const body = await request.json();
    if (String(body?.action || '').trim() === 'bind_code') {
      const result = await bindReferralCodeToCampaign({
        codeId: body?.codeId,
        campaignSlug: body?.campaignSlug || null,
      });
      return NextResponse.json({ success: true, data: result });
    }
    const row = await upsertReferralCampaign(body || {});
    return NextResponse.json({ success: true, data: row }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_CAMPAIGN_CREATE_FAILED' },
      { status: 400 },
    );
  }
}

