import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import {
  exportBookingsCsv,
  exportEscrowAgingCsv,
  exportPlBatchCsv,
} from '@/lib/analytics/export/intelligence-csv.js';
import {
  exportPeriodSummaryXlsx,
  exportBookingsPlXlsx,
  exportEscrowAgingXlsx,
} from '@/lib/analytics/export/intelligence-xlsx.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/finance/intelligence/export
 * Query: type=bookings|escrow-aging|pl-batch|summary-xlsx|bookings-xlsx|escrow-aging-xlsx
 *        format=csv|xlsx (legacy: xlsx types above), period, minDays, bookingIds
 */
export async function GET(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'bookings';
    const format = url.searchParams.get('format') || 'csv';
    const period = url.searchParams.get('period') || '30d';
    const excludeTest = url.searchParams.get('excludeTest') !== '0';
    const minDays = Number(url.searchParams.get('minDays') || 7);
    const bookingIds = (url.searchParams.get('bookingIds') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const wantsXlsx =
      format === 'xlsx' ||
      type === 'summary-xlsx' ||
      type === 'bookings-xlsx' ||
      type === 'escrow-aging-xlsx';

    if (wantsXlsx) {
      let xlsxResult;
      if (type === 'summary-xlsx' || (format === 'xlsx' && type === 'summary')) {
        xlsxResult = await exportPeriodSummaryXlsx({ periodPreset: period, excludeTest });
      } else if (type === 'escrow-aging-xlsx' || (format === 'xlsx' && type === 'escrow-aging')) {
        xlsxResult = await exportEscrowAgingXlsx({ excludeTest, minDays });
      } else {
        xlsxResult = await exportBookingsPlXlsx({ periodPreset: period, excludeTest });
      }
      return new NextResponse(xlsxResult.buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${xlsxResult.filename}"`,
          'X-Row-Count': String(xlsxResult.rowCount ?? 0),
        },
      });
    }

    let result;
    if (type === 'escrow-aging') {
      result = await exportEscrowAgingCsv({ excludeTest, minDays });
    } else if (type === 'pl-batch') {
      result = await exportPlBatchCsv({ bookingIds, excludeTest });
    } else {
      result = await exportBookingsCsv({ periodPreset: period, excludeTest });
    }

    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'X-Row-Count': String(result.rowCount),
      },
    });
  } catch (error) {
    console.error('[finance/intelligence/export]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'EXPORT_FAILED' },
      { status: 500 },
    );
  }
}
