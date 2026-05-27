/**
 * POST /api/v2/admin/payouts/tbank-registry — CSV для Т-Банка + статус PROCESSING для включённых выплат.
 */

import { NextResponse } from 'next/server';
import TbankPayoutRegistryService, {
  encodeTbankCsvForDownload,
} from '@/lib/services/tbank-payout-registry.service';
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const access = await requireAdminStaff(request);
  if (access.error) return { error: access.error };
  return { userId: access.profile?.id || null };
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return auth.error;
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const encoding =
    body?.encoding === 'windows-1251' || body?.encoding === 'cp1251' ? 'windows-1251' : 'utf-8';

  try {
    const { csv, exportedIds, skippedUnverified } = await TbankPayoutRegistryService.exportRegistryAndMarkProcessing();
    const filename = `tbank-payout-registry-${new Date().toISOString().slice(0, 10)}.csv`;
    if (encoding === 'windows-1251') {
      const buf = encodeTbankCsvForDownload(csv, 'windows-1251');
      return NextResponse.json({
        success: true,
        data: {
          encoding: 'windows-1251',
          csvBase64: buf.toString('base64'),
          filename,
          exportedCount: exportedIds.length,
          exportedIds,
          skippedUnverified,
        },
      });
    }
    return NextResponse.json({
      success: true,
      data: {
        encoding: 'utf-8',
        csv,
        filename,
        exportedCount: exportedIds.length,
        exportedIds,
        skippedUnverified,
      },
    });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
