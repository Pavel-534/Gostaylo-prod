import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import {
  createBankReconciliationEntry,
  listBankReconciliationEntries,
} from '@/lib/analytics/store/bank-reconciliation.store.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/intelligence/bank-reconciliation?limit=5
 */
export async function GET(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get('limit') || 5);
    const result = await listBankReconciliationEntries({ limit });
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
    return NextResponse.json({
      success: true,
      data: { rows: result.rows, latest: result.latest, tableMissing: result.tableMissing === true },
    });
  } catch (error) {
    console.error('[finance/intelligence/bank-reconciliation GET]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'BANK_RECON_READ_FAILED' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/finance/intelligence/bank-reconciliation
 * Body: { manualBalanceThb, glGuestClearingThb, ledgerDeltaThb?, cashAtRiskThb?, note? }
 */
export async function POST(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await createBankReconciliationEntry({
      recordedBy: gate.profile?.id || null,
      manualBalanceThb: body.manualBalanceThb,
      glGuestClearingThb: body.glGuestClearingThb,
      ledgerDeltaThb: body.ledgerDeltaThb,
      cashAtRiskThb: body.cashAtRiskThb,
      note: body.note,
    });

    if (!result.success) {
      const status = result.error === 'MANUAL_BALANCE_REQUIRED' ? 400 : 500;
      return NextResponse.json({ success: false, error: result.error }, { status });
    }

    return NextResponse.json({ success: true, data: result.entry });
  } catch (error) {
    console.error('[finance/intelligence/bank-reconciliation POST]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'BANK_RECON_SAVE_FAILED' },
      { status: 500 },
    );
  }
}
