/**
 * DELETE /api/admin/promo-codes/[id] — удаление промокода (ADMIN).
 * PATCH — Stage 32.0: `action: 'extend_uses'` (+`add`, default 100) для PLATFORM-кодов.
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'
import { mapPromoRowToAdminDto } from '@/lib/promo/promo-codes-admin-map'

export const dynamic = 'force-dynamic'

export async function PATCH(request, { params }) {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ error: session.error.message }, { status: session.error.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const id = String(params?.id || '').trim()
  if (!id) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (String(body?.action || '') !== 'extend_uses') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const add = Math.min(10_000, Math.max(1, parseInt(String(body?.add ?? '100'), 10) || 100))

  const { data: row, error: fe } = await supabaseAdmin
    .from('promo_codes')
    .select('id, max_uses, current_uses, created_by_type')
    .eq('id', id)
    .maybeSingle()

  if (fe || !row) {
    return NextResponse.json({ error: 'Promo not found' }, { status: 404 })
  }

  if (String(row.created_by_type || 'PLATFORM').toUpperCase() !== 'PLATFORM') {
    return NextResponse.json({ error: 'Extend is only allowed for PLATFORM promo codes' }, { status: 400 })
  }

  const curUses = Math.max(0, Number(row.current_uses) || 0)
  let newMax
  if (row.max_uses == null) {
    newMax = Math.max(curUses + add, add)
  } else {
    newMax = Number(row.max_uses) + add
  }

  const { data: updated, error: ue } = await supabaseAdmin
    .from('promo_codes')
    .update({ max_uses: newMax })
    .eq('id', id)
    .select('*')
    .single()

  if (ue) {
    return NextResponse.json({ error: ue.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, data: mapPromoRowToAdminDto(updated) })
}

export async function DELETE(_request, { params }) {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ error: session.error.message }, { status: session.error.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const id = String(params?.id || '').trim()
  if (!id) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.from('promo_codes').delete().eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
