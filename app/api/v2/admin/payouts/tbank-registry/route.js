/**
 * POST /api/v2/admin/payouts/tbank-registry — CSV для Т-Банка + статус PROCESSING для включённых выплат.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getSessionPayload } from '@/lib/services/session-service';
import TbankPayoutRegistryService, {
  encodeTbankCsvForDownload,
} from '@/lib/services/tbank-payout-registry.service';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await getSessionPayload();
  if (!session?.userId) return { error: 'Unauthorized', status: 401 };

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', session.userId)
    .maybeSingle();
  if (error) return { error: error.message, status: 500 };

  if (String(data?.role || '').toUpperCase() !== 'ADMIN') {
    return { error: 'Admin access required', status: 403 };
  }
  return { userId: session.userId };
}

export async function POST(request) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
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
