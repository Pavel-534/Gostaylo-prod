/**
 * GET /api/admin/promo-codes/analytics/top-partners — партнёры с наибольшим числом PARTNER-промокодов (Stage 33).
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { resolveAdminSecurityProfile } from '@/lib/admin-security-access'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await resolveAdminSecurityProfile()
  if (session.error) {
    return NextResponse.json({ error: session.error.message }, { status: session.error.status })
  }
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
  }

  const { data: rows, error } = await supabaseAdmin
    .from('promo_codes')
    .select('id, partner_id, code, current_uses, max_uses, is_active, created_by_type')
    .eq('created_by_type', 'PARTNER')
    .not('partner_id', 'is', null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const byPartner = new Map()
  for (const r of rows || []) {
    const pid = String(r.partner_id || '')
    if (!pid) continue
    const cur =
      byPartner.get(pid) ||
      ({
        partnerId: pid,
        promoCount: 0,
        totalUses: 0,
        codes: [],
      })
    cur.promoCount += 1
    cur.totalUses += Number(r.current_uses) || 0
    if (cur.codes.length < 5) cur.codes.push(String(r.code || ''))
    byPartner.set(pid, cur)
  }

  const ranked = [...byPartner.values()].sort((a, b) => {
    if (b.promoCount !== a.promoCount) return b.promoCount - a.promoCount
    return b.totalUses - a.totalUses
  })

  const top = ranked.slice(0, 15)
  const ids = top.map((t) => t.partnerId)
  let profileById = new Map()
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', ids)
    profileById = new Map((profiles || []).map((p) => [String(p.id), p]))
  }

  const data = top.map((row) => {
    const p = profileById.get(row.partnerId)
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim()
    return {
      ...row,
      partnerName: name || null,
      partnerEmail: p?.email || null,
    }
  })

  return NextResponse.json({ success: true, data })
}
