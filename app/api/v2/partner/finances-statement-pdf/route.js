/**
 * GET /api/v2/partner/finances-statement-pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 * Legacy alias (created_at axis, PDF only). Canonical: GET /api/v2/partner/finances-export
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { supabaseAdmin } from '@/lib/supabase'
import { getSiteBrandSlug } from '@/lib/site-url'
import { renderPartnerFinancialStatementPdf } from '@/lib/services/partner-finances-pdf.service'
import {
  parsePartnerFinancesExportParams,
  loadPartnerFinancesExportBookings,
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
      format: 'pdf',
      axis: 'created',
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

    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('first_name,last_name,email')
      .eq('id', userId)
      .maybeSingle()

    const partnerLabel =
      [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || prof?.email || userId

    const pdfBuffer = await renderPartnerFinancialStatementPdf({
      partnerLabel,
      fromYmd: parsed.fromYmd,
      toYmd: parsed.toYmd,
      rows: loaded.rows,
      axis: parsed.axis,
    })

    const filename = `${getSiteBrandSlug()}-statement-${parsed.fromYmd}-to-${parsed.toYmd}.pdf`
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('[FINANCES-STATEMENT-PDF]', e)
    return NextResponse.json({ success: false, error: e.message || 'pdf' }, { status: 500 })
  }
}
