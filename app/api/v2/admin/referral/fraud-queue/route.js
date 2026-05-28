import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import ReferralGuardService from '@/lib/services/marketing/referral-guard.service';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const { searchParams } = new URL(request.url);
    const status = String(searchParams.get('status') || 'open');
    const limit = Number(searchParams.get('limit') || 100);
    const rows = await ReferralGuardService.listFraudQueue({ status, limit });
    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'FRAUD_QUEUE_LIST_FAILED' },
      { status: 500 },
    );
  }
}
