import { NextResponse } from 'next/server'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { supabaseAdmin } from '@/lib/supabase'
import { loadFintechMovements, MOVEMENT_KINDS } from '@/lib/admin/fintech-movements-feed'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const gate = await requireAdminStaff()
  if (gate.error) return gate.error

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  if (!from || !to) {
    return NextResponse.json({ success: false, error: 'from and to are required' }, { status: 400 })
  }

  const kind = searchParams.get('kind') || ''
  const currency = String(searchParams.get('currency') || '')
    .trim()
    .toUpperCase()
  const partnerId = String(searchParams.get('partnerId') || '').trim() || null
  const limit = Number(searchParams.get('limit')) || 300

  if (kind && !Object.values(MOVEMENT_KINDS).includes(kind)) {
    return NextResponse.json({ success: false, error: 'invalid kind' }, { status: 400 })
  }

  try {
    const movements = await loadFintechMovements(supabaseAdmin, {
      from,
      to,
      kind: kind || undefined,
      currency: currency || undefined,
      partnerId,
      limit,
    })

    let filtered = movements
    if (currency) {
      filtered = movements.filter(
        (m) =>
          m.currency === currency ||
          m.meta?.amountFrom != null ||
          m.kind === MOVEMENT_KINDS.PAYOUT_BATCH,
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        period: { from, to },
        filters: { kind: kind || null, currency: currency || null, partnerId },
        movements: filtered,
      },
    })
  } catch (e) {
    return NextResponse.json({ success: false, error: e?.message || String(e) }, { status: 500 })
  }
}
