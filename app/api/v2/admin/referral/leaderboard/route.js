import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getSessionPayload } from '@/lib/services/session-service'
import { aggregateReferralLeaderboardFromDb } from '@/lib/referral/referral-leaderboard-db'
import { utcCalendarMonthBounds, currentUtcYearMonth } from '@/lib/referral/utc-month-bounds'
import { formatReferralDateDdMmYyyyInTimeZone } from '@/lib/referral/format-referral-datetime'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const session = await getSessionPayload()
  if (!session?.userId) return { error: 'Unauthorized', status: 401 }
  const { data, error } = await supabaseAdmin.from('profiles').select('role').eq('id', session.userId).maybeSingle()
  if (error) return { error: error.message, status: 500 }
  if (String(data?.role || '').toUpperCase() !== 'ADMIN') {
    return { error: 'Admin access required', status: 403 }
  }
  return { ok: true }
}

function fullDisplayName(firstName, lastName, email) {
  const f = typeof firstName === 'string' ? firstName.trim() : ''
  const l = typeof lastName === 'string' ? lastName.trim() : ''
  if (f && l) return `${f} ${l}`.trim()
  if (f) return f
  if (l) return l
  const e = typeof email === 'string' ? email.trim() : ''
  return e || '—'
}

/**
 * GET — глобальный топ по UTC (компания). Query: year, month (календарный месяц UTC), limit (max 50).
 */
export async function GET(request) {
  const auth = await requireAdmin()
  if (auth.error) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const now = currentUtcYearMonth()
  const yearRaw = searchParams.get('year')
  const monthRaw = searchParams.get('month')
  const year = yearRaw != null ? Number.parseInt(yearRaw, 10) : now.year
  const month = monthRaw != null ? Number.parseInt(monthRaw, 10) : now.month
  if (!Number.isFinite(year) || year < 2020 || year > 2100) {
    return NextResponse.json({ success: false, error: 'INVALID_YEAR' }, { status: 400 })
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ success: false, error: 'INVALID_MONTH' }, { status: 400 })
  }

  const limit = Math.min(50, Math.max(1, Math.floor(Number(searchParams.get('limit') || 25))))
  const bounds = utcCalendarMonthBounds(year, month)

  const agg = await aggregateReferralLeaderboardFromDb(
    supabaseAdmin,
    bounds.monthStartUtcIso,
    bounds.monthEndExclusiveUtcIso,
    limit,
  )

  const ids = agg.map((x) => x.referrerId)
  let profilesById = {}
  if (ids.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name, email')
      .in('id', ids)
    for (const p of profiles || []) {
      profilesById[String(p.id)] = p
    }
  }

  const rows = agg.map((row, i) => {
    const p = profilesById[row.referrerId]
    const displayNameFull = fullDisplayName(p?.first_name, p?.last_name, p?.email)
    return {
      rank: i + 1,
      referrerId: row.referrerId,
      amountThb: row.amountThb,
      displayNameFull,
      adminProfileUrl: `/admin/users/${encodeURIComponent(row.referrerId)}`,
    }
  })

  const periodStartLabel = formatReferralDateDdMmYyyyInTimeZone(bounds.monthStartUtcIso, 'UTC')
  const lastMs = Date.parse(bounds.monthEndExclusiveUtcIso) - 1
  const periodEndLabel = formatReferralDateDdMmYyyyInTimeZone(new Date(lastMs), 'UTC')

  return NextResponse.json(
    {
      success: true,
      data: {
        calendar: 'UTC',
        yearMonthKey: bounds.ymKey,
        periodStartDdMmYyyy: periodStartLabel,
        periodEndDdMmYyyy: periodEndLabel,
        monthStartUtcIso: bounds.monthStartUtcIso,
        monthEndExclusiveUtcIso: bounds.monthEndExclusiveUtcIso,
        rows,
      },
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
