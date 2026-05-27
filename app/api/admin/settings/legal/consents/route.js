/**
 * GET /api/admin/settings/legal/consents?type=guest|partner|booking&version=&from=&to=&limit=
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'

export const dynamic = 'force-dynamic'

const MAX_LIMIT = 100

export async function GET(request) {
  const gate = await requireAdminStaff(request)
  if (gate.error) return gate.error

  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Database not configured' }, { status: 503 })
  }

  const { searchParams } = new URL(request.url)
  const type = String(searchParams.get('type') || 'all').toLowerCase()
  const version = searchParams.get('version')?.trim() || null
  const from = searchParams.get('from')?.trim() || null
  const to = searchParams.get('to')?.trim() || null
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(String(searchParams.get('limit') || '30'), 10) || 30),
  )

  const rows = []

  if (type === 'all' || type === 'guest') {
    let q = supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, terms_accepted_at, terms_version, legal_terms_accepted_at')
      .not('terms_accepted_at', 'is', null)
      .order('terms_accepted_at', { ascending: false })
      .limit(limit)

    if (version) q = q.eq('terms_version', version)
    if (from) q = q.gte('terms_accepted_at', from)
    if (to) q = q.lte('terms_accepted_at', `${to}T23:59:59.999Z`)

    const { data, error } = await q
    if (error && !String(error.message).includes('terms_version')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    for (const p of data || []) {
      rows.push({
        kind: 'guest',
        userId: p.id,
        email: p.email,
        name: p.full_name,
        acceptedAt: p.terms_accepted_at || p.legal_terms_accepted_at,
        version: p.terms_version,
      })
    }
  }

  if (type === 'all' || type === 'partner') {
    let q = supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, partner_terms_accepted_at, partner_terms_version')
      .not('partner_terms_accepted_at', 'is', null)
      .order('partner_terms_accepted_at', { ascending: false })
      .limit(limit)

    if (version) q = q.eq('partner_terms_version', version)
    if (from) q = q.gte('partner_terms_accepted_at', from)
    if (to) q = q.lte('partner_terms_accepted_at', `${to}T23:59:59.999Z`)

    const { data, error } = await q
    if (error && !String(error.message).includes('partner_terms')) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    for (const p of data || []) {
      rows.push({
        kind: 'partner',
        userId: p.id,
        email: p.email,
        name: p.full_name,
        acceptedAt: p.partner_terms_accepted_at,
        version: p.partner_terms_version,
      })
    }
  }

  if (type === 'booking') {
    let q = supabaseAdmin
      .from('bookings')
      .select('id, renter_id, terms_accepted_at, terms_version, status, created_at')
      .not('terms_accepted_at', 'is', null)
      .order('terms_accepted_at', { ascending: false })
      .limit(limit)

    if (version) q = q.eq('terms_version', version)
    if (from) q = q.gte('terms_accepted_at', from)
    if (to) q = q.lte('terms_accepted_at', `${to}T23:59:59.999Z`)

    const { data, error } = await q
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    for (const b of data || []) {
      rows.push({
        kind: 'booking',
        bookingId: b.id,
        userId: b.renter_id,
        acceptedAt: b.terms_accepted_at,
        version: b.terms_version,
        status: b.status,
      })
    }
  }

  rows.sort((a, b) => {
    const ta = new Date(a.acceptedAt || 0).getTime()
    const tb = new Date(b.acceptedAt || 0).getTime()
    return tb - ta
  })

  return NextResponse.json({
    success: true,
    data: { rows: rows.slice(0, limit), filters: { type, version, from, to, limit } },
  })
}
