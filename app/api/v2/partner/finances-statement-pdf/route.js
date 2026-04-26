/**
 * GET /api/v2/partner/finances-statement-pdf?from=YYYY-MM-DD&to=YYYY-MM-DD
 * PDF statement by booking created_at (UTC), read-model SSOT (Stage 46.0).
 */

import { NextResponse } from 'next/server'
import { getUserIdFromSession, verifyPartnerAccess } from '@/lib/services/session-service'
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase'
import { renderPartnerFinancialStatementPdf } from '@/lib/services/partner-finances-pdf.service'

export const dynamic = 'force-dynamic'

const YMD = /^\d{4}-\d{2}-\d{2}$/
const MAX_RANGE_DAYS = 366

function parseYmd(s) {
  if (!s || !YMD.test(String(s))) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

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
    const fromRaw = searchParams.get('from')
    const toRaw = searchParams.get('to')
    const fromD = parseYmd(fromRaw)
    const toD = parseYmd(toRaw)
    if (!fromD || !toD || fromD > toD) {
      return NextResponse.json(
        { success: false, error: 'INVALID_DATE_RANGE', hint: 'Use from=YYYY-MM-DD&to=YYYY-MM-DD' },
        { status: 400 },
      )
    }
    const spanMs = toD.getTime() - fromD.getTime()
    if (spanMs > MAX_RANGE_DAYS * 86400000) {
      return NextResponse.json({ success: false, error: 'RANGE_TOO_LARGE', maxDays: MAX_RANGE_DAYS }, { status: 400 })
    }

    if (!isSupabaseConfigured() || !supabaseAdmin) {
      return NextResponse.json({ success: false, error: 'SERVICE_UNAVAILABLE' }, { status: 503 })
    }

    const fromIso = `${fromRaw}T00:00:00.000Z`
    const toIso = `${toRaw}T23:59:59.999Z`

    const { data: rows, error } = await supabaseAdmin
      .from('bookings')
      .select(
        `
        id,status,created_at,currency,listing_currency,price_thb,price_paid,exchange_rate,commission_thb,commission_rate,applied_commission_rate,partner_earnings_thb,taxable_margin_amount,rounding_diff_pot,pricing_snapshot,guest_name,metadata,
        listing:listings(category_id,categories(slug))
      `,
      )
      .eq('partner_id', userId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso)
      .order('created_at', { ascending: true })
      .limit(2000)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('first_name,last_name,email')
      .eq('id', userId)
      .maybeSingle()

    const partnerLabel = [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || prof?.email || userId

    const pdfBuffer = await renderPartnerFinancialStatementPdf({
      partnerLabel,
      fromYmd: fromRaw,
      toYmd: toRaw,
      rows: rows || [],
    })

    const filename = `gostaylo-statement-${fromRaw}-to-${toRaw}.pdf`
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
