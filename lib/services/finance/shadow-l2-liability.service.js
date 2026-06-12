/**
 * Stage 131.1 — admin read model for shadow L2 liability (view + fallbacks).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { SystemConfigService } from '@/lib/services/finance/system-config.service.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function monthStartUtcDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

async function readShadowRowsFromView(monthUtc = null) {
  let q = supabaseAdmin
    .from('referral_shadow_l2_monthly')
    .select('l2_referrer_id, month_utc, booking_count, shadow_l2_thb_sum')
    .order('shadow_l2_thb_sum', { ascending: false })

  if (monthUtc) q = q.eq('month_utc', monthUtc)

  const { data, error } = await q
  if (error) {
    if (String(error.message || '').includes('does not exist')) return null
    throw new Error(error.message || 'SHADOW_L2_VIEW_READ_FAILED')
  }
  return data || []
}

/** Fallback scan when view not migrated yet. */
async function scanShadowFromBookings(monthStartIso) {
  const { data, error } = await supabaseAdmin
    .from('bookings')
    .select('metadata, completed_at')
    .eq('status', 'COMPLETED')
    .gte('completed_at', monthStartIso)

  if (error) throw new Error(error.message || 'SHADOW_L2_BOOKINGS_SCAN_FAILED')

  const byKey = new Map()
  for (const row of data || []) {
    const snap = row?.metadata?.fintech_snapshot
    if (!snap || typeof snap !== 'object') continue
    const l2Id = String(snap.shadow_l2_referrer_id || '').trim()
    const amt = round2(snap.shadow_l2_thb)
    if (!l2Id || amt <= 0) continue
    const d = row.completed_at ? new Date(row.completed_at) : new Date()
    const monthUtc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10)
    const key = `${l2Id}|${monthUtc}`
    const prev = byKey.get(key) || { l2_referrer_id: l2Id, month_utc: monthUtc, booking_count: 0, shadow_l2_thb_sum: 0 }
    prev.booking_count += 1
    prev.shadow_l2_thb_sum = round2(prev.shadow_l2_thb_sum + amt)
    byKey.set(key, prev)
  }
  return [...byKey.values()].sort((a, b) => b.shadow_l2_thb_sum - a.shadow_l2_thb_sum)
}

async function enrichProfiles(rows) {
  const ids = [...new Set((rows || []).map((r) => String(r.l2_referrer_id || '').trim()).filter(Boolean))]
  if (!ids.length) return rows

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email, referral_code')
    .in('id', ids)

  const byId = new Map((profiles || []).map((p) => [String(p.id), p]))
  return (rows || []).map((r) => {
    const p = byId.get(String(r.l2_referrer_id))
    const name = [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim()
    return {
      ...r,
      shadow_l2_thb_sum: round2(r.shadow_l2_thb_sum),
      mentor_name: name || null,
      mentor_email: p?.email || null,
      mentor_referral_code: p?.referral_code || null,
    }
  })
}

export async function getShadowL2LiabilityDashboard({ months = 6 } = {}) {
  const config = await SystemConfigService.getFintechConfig()
  const currentMonth = monthStartUtcDate()
  const monthStartIso = new Date(`${currentMonth}T00:00:00.000Z`).toISOString()

  let allRows = await readShadowRowsFromView()
  if (allRows === null) {
    allRows = await scanShadowFromBookings(
      new Date(Date.now() - Math.max(1, months) * 31 * 86400000).toISOString(),
    )
  }

  const currentMonthRows = (allRows || []).filter((r) => String(r.month_utc) === currentMonth)
  const currentMonthTotal = round2(
    currentMonthRows.reduce((acc, r) => acc + (Number(r.shadow_l2_thb_sum) || 0), 0),
  )
  const allTimeTotal = round2(
    (allRows || []).reduce((acc, r) => acc + (Number(r.shadow_l2_thb_sum) || 0), 0),
  )

  const mentorTotals = new Map()
  for (const r of allRows || []) {
    const id = String(r.l2_referrer_id || '').trim()
    if (!id) continue
    mentorTotals.set(id, round2((mentorTotals.get(id) || 0) + (Number(r.shadow_l2_thb_sum) || 0)))
  }
  const topMentorIds = [...mentorTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([id, total]) => ({ l2_referrer_id: id, shadow_l2_thb_sum: total }))

  const topMentors = await enrichProfiles(topMentorIds)
  const currentMonthEnriched = await enrichProfiles(currentMonthRows)

  const monthlyCap = round2(config.ambassadorGuestL2MaxThbPerMonth)
  const capPressure = topMentors.map((m) => {
    const monthRow = currentMonthRows.find((r) => String(r.l2_referrer_id) === String(m.l2_referrer_id))
    const spent = round2(monthRow?.shadow_l2_thb_sum || 0)
    return {
      ...m,
      month_shadow_thb: spent,
      monthly_cap_thb: monthlyCap,
      cap_utilization_pct: monthlyCap > 0 ? round2((spent / monthlyCap) * 100) : 0,
      at_cap: monthlyCap > 0 && spent >= monthlyCap - 0.01,
    }
  })

  return {
    mode: config.ambassadorGuestL2Enabled ? 'live' : 'shadow',
    currentMonthUtc: currentMonth,
    totals: {
      currentMonthShadowThb: currentMonthTotal,
      allTimeShadowThb: allTimeTotal,
      mentorCount: mentorTotals.size,
    },
    config: {
      l2MonthlyCapThb: monthlyCap,
      l2PerBookingCapThb: round2(config.ambassadorGuestL2MaxThbPerBooking),
      l2Percent: config.ambassadorGuestPoolL2Percent,
    },
    topMentors: capPressure,
    currentMonthByMentor: currentMonthEnriched,
    monthlySeries: (allRows || [])
      .reduce((acc, r) => {
        const m = String(r.month_utc)
        acc[m] = round2((acc[m] || 0) + (Number(r.shadow_l2_thb_sum) || 0))
        return acc
      }, {}),
    projectionNote:
      config.ambassadorGuestL2Enabled
        ? 'L2 live — shadow view historical only'
        : `При включении L2 потенциальная нагрузка ≈ payable shadow accruals (cap ${monthlyCap} THB/мес/наставник)`,
  }
}

export default { getShadowL2LiabilityDashboard }
