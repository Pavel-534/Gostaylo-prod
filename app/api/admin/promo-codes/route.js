/**
 * GET/POST /api/admin/promo-codes — список и создание промокодов (ADMIN, SSOT с `PricingService.validatePromoCode`).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'
import { buildPromoInsertFromAdminBody, mapPromoRowToAdminDto } from '@/lib/promo/promo-codes-admin-map'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ error: session.error.message }, { status: session.error.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const { data, error } = await supabaseAdmin
    .from('promo_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    data: (data || []).map(mapPromoRowToAdminDto).filter(Boolean),
  })
}

export async function POST(request) {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ error: session.error.message }, { status: session.error.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  let insert
  try {
    insert = buildPromoInsertFromAdminBody(body)
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'Validation failed' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.from('promo_codes').insert(insert).select('*').single()

  if (error) {
    if (String(error.message || '').includes('duplicate') || error.code === '23505') {
      return NextResponse.json({ error: 'Promo code already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data: mapPromoRowToAdminDto(data) }, { status: 201 })
}
