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

  const promoRows = Array.isArray(data) ? data : []
  const promoCodes = promoRows
    .map((row) => String(row?.code || '').trim().toUpperCase())
    .filter(Boolean)

  const createdByPromo = new Map()
  if (promoCodes.length > 0) {
    const { data: bookingsRows, error: bookingsError } = await supabaseAdmin
      .from('bookings')
      .select('promo_code_used')
      .in('promo_code_used', promoCodes)
    if (!bookingsError && Array.isArray(bookingsRows)) {
      for (const row of bookingsRows) {
        const code = String(row?.promo_code_used || '').trim().toUpperCase()
        if (!code) continue
        createdByPromo.set(code, (createdByPromo.get(code) || 0) + 1)
      }
    }
  }

  return NextResponse.json({
    data: promoRows
      .map((row) => ({
        ...row,
        bookings_created_count: createdByPromo.get(String(row?.code || '').trim().toUpperCase()) || 0,
      }))
      .map(mapPromoRowToAdminDto)
      .filter(Boolean),
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
