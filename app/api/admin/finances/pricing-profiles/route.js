import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const COLS =
  'id,name,is_default,is_active,guest_fee_pct,host_fee_pct,fx_markup_pct,ru_agent_share_pct,kr_service_share_pct,insurance_fund_pct,tax_rate_pct,metadata'

export async function GET() {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const { data, error } = await supabaseAdmin
    .from('pricing_profiles')
    .select(COLS)
    .order('name')
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, data })
}

export async function POST(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || `pp-${Date.now()}`).trim()
  const row = {
    id,
    name: String(body.name || id),
    is_default: Boolean(body.is_default),
    is_active: body.is_active !== false,
    guest_fee_pct: Number(body.guest_fee_pct),
    host_fee_pct: Number(body.host_fee_pct ?? 0),
    fx_markup_pct: Number(body.fx_markup_pct ?? 0),
    ru_agent_share_pct: Number(body.ru_agent_share_pct),
    kr_service_share_pct: Number(body.kr_service_share_pct),
    insurance_fund_pct: Number(body.insurance_fund_pct ?? 0),
    tax_rate_pct: Number(body.tax_rate_pct ?? 0),
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  }

  const { data, error } = await supabaseAdmin.from('pricing_profiles').insert(row).select(COLS).single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, data })
}
