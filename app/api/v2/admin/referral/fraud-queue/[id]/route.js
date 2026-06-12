import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import ReferralFraudResolveService from '@/lib/services/marketing/referral-fraud-resolve.service.js';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const body = await request.json();
    const result = await ReferralFraudResolveService.resolveFraudItem({
      id: params?.id,
      action: body?.action,
      adminUserId: access.profile?.id || null,
      note: body?.note,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'FRAUD_QUEUE_REVIEW_FAILED' },
      { status: 400 },
    );
  }
}
