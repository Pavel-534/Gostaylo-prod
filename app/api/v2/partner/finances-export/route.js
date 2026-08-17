/**
 * GET /api/v2/partner/finances-export?from=&to=&format=csv|pdf&axis=created|checkout
 * Stage 211.1 — partner statement download (read-model SSOT).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { renderPartnerFinancialStatementPdf } from '@/lib/services/partner-finances-pdf.service'
import { computePartnerFinancesPeriodPack } from '@/lib/services/partner-finances-period.service'
import {
  parsePartnerFinancesExportParams,
  loadPartnerFinancesExportBookings,
  renderPartnerFinancialStatementCsv,
  buildPartnerFinancesExportFilename,
} from '@/lib/services/partner-finances-export.service'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request) {
  try {
    const userId = await getUserIdFromSession()
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }
    const partner = await verifyPartnerAccess(userId)
    if (!partner) {
      return NextResponse.json({ success: false, error: 'Partner access denied' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = parsePartnerFinancesExportParams({
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      format: searchParams.get('format'),
      axis: searchParams.get('axis'),
    })
    if (!parsed.ok) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error,
          hint: parsed.hint,
          maxDays: parsed.maxDays,
        },
        { status: parsed.status },
      )
    }

    const loaded = await loadPartnerFinancesExportBookings({
      partnerId: userId,
      fromYmd: parsed.fromYmd,
      toYmd: parsed.toYmd,
      axis: parsed.axis,
    })
    if (!loaded.success) {
      return NextResponse.json(
        { success: false, error: loaded.error },
        { status: loaded.status || 500 },
      )
    }

    const filename = buildPartnerFinancesExportFilename({
      fromYmd: parsed.fromYmd,
      toYmd: parsed.toYmd,
      format: parsed.format,
    })

    if (parsed.format === 'csv') {
      const csv = renderPartnerFinancialStatementCsv(loaded.rows)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('first_name,last_name,email')
      .eq('id', userId)
      .maybeSingle()

    const partnerLabel =
      [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || prof?.email || userId

    const periodPack = await computePartnerFinancesPeriodPack({
      partnerId: userId,
      fromYmd: parsed.fromYmd,
      toYmd: parsed.toYmd,
      axis: parsed.axis,
      bookingRows: loaded.rows,
    })

    const pdfBuffer = await renderPartnerFinancialStatementPdf({
      partnerLabel,
      fromYmd: parsed.fromYmd,
      toYmd: parsed.toYmd,
      rows: loaded.rows,
      axis: parsed.axis,
      periodTotals: periodPack.success ? periodPack.data : null,
    })

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[FINANCES-EXPORT]', e)
    return NextResponse.json({ success: false, error: e.message || 'export' }, { status: 500 })
  }
}
