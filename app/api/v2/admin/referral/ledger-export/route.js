/**
 * GET /api/v2/admin/referral/ledger-export
 * Stage 114.4 — фильтры + CSV export referral_ledger.
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import { buildReferralLedgerQuery } from '@/lib/admin/referral-ledger-query.js'
import { referralLedgerToCsv } from '@/lib/admin/referral-ledger-export.js'

export const dynamic = 'force-dynamic'

export async function GET(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  const { searchParams } = new URL(request.url)
  const format = String(searchParams.get('format') || 'csv').toLowerCase()
  const filters = {
    status: searchParams.get('status') || 'all',
    type: searchParams.get('type') || 'all',
    referralType: searchParams.get('referralType') || 'all',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    referrerId: searchParams.get('referrerId') || '',
    bookingId: searchParams.get('bookingId') || '',
    limit: Number(searchParams.get('limit')) || 2000,
  }

  try {
    const { data: rows, error } = await buildReferralLedgerQuery(filters)
    if (error) {
      return NextResponse.json(
        { success: false, error: error.message || 'REFERRAL_LEDGER_EXPORT_FAILED' },
        { status: 500 },
      )
    }

    const referrerIds = [...new Set((rows || []).map((r) => String(r.referrer_id || '')).filter(Boolean))]
    let profileMap = {}
    if (referrerIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id,email')
        .in('id', referrerIds.slice(0, 200))
      profileMap = Object.fromEntries((profiles || []).map((p) => [String(p.id), p]))
    }

    const enriched = (rows || []).map((row) => ({
      ...row,
      referrer_email: profileMap[String(row.referrer_id || '')]?.email || '',
    }))

    if (format === 'json') {
      return NextResponse.json({ success: true, data: enriched, filters })
    }

    const csv = referralLedgerToCsv(enriched)
    const stamp = new Date().toISOString().slice(0, 10)
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="referral-ledger-${stamp}.csv"`,
      },
    })
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e?.message || 'REFERRAL_LEDGER_EXPORT_FAILED' },
      { status: 500 },
    )
  }
}
