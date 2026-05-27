import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const COLS =
  'id,name,is_default,is_active,guest_fee_pct,host_fee_pct,fx_markup_pct,ru_agent_share_pct,kr_service_share_pct,insurance_fund_pct,tax_rate_pct,metadata'

export async function PATCH(request, { params }) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const id = params.id
  const body = await request.json().catch(() => ({}))
  if (
    body.guest_fee_pct !== undefined ||
    body.ru_agent_share_pct !== undefined ||
    body.kr_service_share_pct !== undefined
  ) {
    const { data: current } = await supabaseAdmin
      .from('pricing_profiles')
      .select('guest_fee_pct,ru_agent_share_pct,kr_service_share_pct')
      .eq('id', id)
      .single()
    const guest = Number(body.guest_fee_pct ?? current?.guest_fee_pct)
    const ru = Number(body.ru_agent_share_pct ?? current?.ru_agent_share_pct)
    const kr = Number(body.kr_service_share_pct ?? current?.kr_service_share_pct)
    if (Math.abs(ru + kr - guest) >= 0.01) {
      return NextResponse.json(
        {
          success: false,
          error: 'INVALID_FEE_SPLIT',
          message: 'ru + kr must equal guest_fee_pct',
        },
        { status: 400 },
      )
    }
  }
  const patch = {}
  for (const key of [
    'name',
    'is_default',
    'is_active',
    'guest_fee_pct',
    'host_fee_pct',
    'fx_markup_pct',
    'ru_agent_share_pct',
    'kr_service_share_pct',
    'insurance_fund_pct',
    'tax_rate_pct',
    'metadata',
  ]) {
    if (body[key] !== undefined) patch[key] = body[key]
  }
  patch.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('pricing_profiles')
    .update(patch)
    .eq('id', id)
    .select(COLS)
    .single()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, data })
}

export async function DELETE(_request, { params }) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  const { error } = await supabaseAdmin
    .from('pricing_profiles')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', params.id)
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}
