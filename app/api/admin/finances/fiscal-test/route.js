import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { computeFinalBreakdown } from '@/lib/pricing-engine/compute-breakdown.js'
import { toFiscalKassaPayload } from '@/lib/pricing-engine/snapshot-adapter.js'
import { isFiscalSandboxEnabled } from '@/lib/pricing-engine/fiscal-config.js'
import { buildFiscalReceiptDisplay } from '@/lib/admin/fiscal-receipt-display.js'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'no_db' }, { status: 503 })
  }

  const { data: profile } = await supabaseAdmin
    .from('pricing_profiles')
    .select('*')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ success: false, error: 'no_active_pricing_profile' }, { status: 400 })
  }

  const breakdown = computeFinalBreakdown({
    subtotal_thb: 1000,
    profile,
    payment_currency: 'RUB',
    listing_base_currency: 'THB',
    raw_fx_rate_map: { THB: 1, RUB: 0.45 },
  })
  const payload = toFiscalKassaPayload(breakdown)
  const sandbox = isFiscalSandboxEnabled()

  if (sandbox) {
    const receiptId = `admin-test-${Date.now()}`
    const display = buildFiscalReceiptDisplay(payload, breakdown)
    return NextResponse.json({
      success: true,
      sandbox: true,
      mode: 'SANDBOX',
      receiptId,
      payload,
      display,
      message: 'Sandbox mock — no OFD call',
    })
  }

  const url = process.env.FISCAL_PROVIDER_URL
  if (!url) {
    return NextResponse.json(
      {
        success: false,
        error: 'FISCAL_PROVIDER_URL not configured',
        mode: 'PRODUCTION',
        payload,
      },
      { status: 400 },
    )
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.FISCAL_PROVIDER_TOKEN
          ? { Authorization: `Bearer ${process.env.FISCAL_PROVIDER_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({
        booking_id: `admin-fiscal-test-${Date.now()}`,
        test: true,
        payload,
      }),
    })
    const text = await res.text().catch(() => '')
    let json = {}
    try {
      json = JSON.parse(text)
    } catch {
      json = { raw: text.slice(0, 500) }
    }
    if (!res.ok) {
      return NextResponse.json(
        {
          success: false,
          mode: 'PRODUCTION',
          httpStatus: res.status,
          error: text.slice(0, 300),
          payload,
        },
        { status: 502 },
      )
    }
    return NextResponse.json({
      success: true,
      mode: 'PRODUCTION',
      receiptId: json.receipt_id || json.receiptId || 'ok',
      payload,
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, mode: 'PRODUCTION', error: e?.message || String(e), payload },
      { status: 502 },
    )
  }
}
