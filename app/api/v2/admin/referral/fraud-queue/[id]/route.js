import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import ReferralGuardService from '@/lib/services/marketing/referral-guard.service';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const access = await requireAdminStaff(request);
  if (access.error) return access.error;
  try {
    const body = await request.json();
    const row = await ReferralGuardService.reviewFraudQueueItem({
      id: params?.id,
      action: body?.action,
      adminUserId: access.profile?.id || null,
      note: body?.note,
    });
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error?.message || 'FRAUD_QUEUE_REVIEW_FAILED' },
      { status: 400 },
    );
  }
}
