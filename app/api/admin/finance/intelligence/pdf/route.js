import { NextResponse } from 'next/server';
import { requireAdminStaff } from '@/lib/security/admin-staff-access';
import {
  renderBookingPlPdf,
  renderPeriodSummaryPdf,
} from '@/lib/analytics/export/intelligence-pdf.js';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/finance/intelligence/pdf
 * Query: type=booking|summary, bookingId, period
 */
export async function GET(request) {
  const gate = await requireAdminStaff(request);
  if (gate.error) return gate.error;

  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') || 'summary';
    const period = url.searchParams.get('period') || '30d';
    const excludeTest = url.searchParams.get('excludeTest') !== '0';
    const bookingId = (url.searchParams.get('bookingId') || '').trim();

    let result;
    if (type === 'booking') {
      if (!bookingId) {
        return NextResponse.json({ success: false, error: 'BOOKING_ID_REQUIRED' }, { status: 400 });
      }
      result = await renderBookingPlPdf(bookingId);
    } else {
      result = await renderPeriodSummaryPdf({ periodPreset: period, excludeTest });
    }

    return new NextResponse(result.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
      },
    });
  } catch (error) {
    console.error('[finance/intelligence/pdf]', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'PDF_EXPORT_FAILED' },
      { status: 500 },
    );
  }
}
