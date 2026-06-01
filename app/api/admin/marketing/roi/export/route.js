import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import {
  exportReferralRoiCsv,
  exportReferralRoiXlsx,
} from '@/lib/analytics/export/referral-roi-export.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/marketing/roi/export?period=7d|30d|today&format=csv|xlsx
 */
export async function GET(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30d';
    const format = url.searchParams.get('format') || 'csv';

    if (format === 'xlsx') {
      const result = await exportReferralRoiXlsx({ periodPreset: period });
      return new NextResponse(result.buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${result.filename}"`,
          'X-Row-Count': String(result.rowCount ?? 0),
        },
      });
    }

    const result = await exportReferralRoiCsv({ periodPreset: period });
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Row-Count': String(result.rowCount ?? 0),
      },
    });
  } catch (error) {
    console.error('[admin/marketing/roi/export]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'REFERRAL_ROI_EXPORT_FAILED' },
      { status: 500 },
    );
  }
}
