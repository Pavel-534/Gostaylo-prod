/**
 * GET /api/v2/admin/ledger-reconciliation — MVP сверка «Cash» (guest clearing) vs распределение.
 */

import { NextResponse } from 'next/server';
import LedgerService from '@/lib/services/ledger.service';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic';

async function requireAdmin(request) {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return { userId: access.profile?.id || null };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.error) {
    return auth.error;
  }

  try {
    const reconciliation = await LedgerService.runReconciliationMvp();
    return NextResponse.json({ success: true, data: reconciliation });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
