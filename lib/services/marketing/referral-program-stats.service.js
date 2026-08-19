/**
 * Quarterly avg earned per active ambassador (ADR-131A §9.6).
 * Read/write `referral_program_stats`. Does not change payout.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { resolveLastClosedQuarterUtc } from '@/lib/referral/last-closed-quarter-utc.js'

const PAGE = 1000

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchAllEarnedGuestRows(startIso, endExclusiveIso) {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb,referrer_id,referee_id')
      .eq('status', 'earned')
      .eq('referral_type', 'guest_booking')
      .gte('earned_at', startIso)
      .lt('earned_at', endExclusiveIso)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message || 'REFERRAL_PROGRAM_STATS_LEDGER_FAILED')
    const batch = data || []
    rows.push(...batch)
    if (batch.length < PAGE) break
    from += PAGE
  }
  return rows
}

/**
 * Distinct referrers who earned in the quarter and have ≥1 referee with a COMPLETED booking
 * in the same window. `referral_relations` has no first_completed_at — JOIN bookings.completed_at.
 */
async function countActiveAmbassadors(earnedReferrerIds, startIso, endExclusiveIso) {
  const ids = [...new Set((earnedReferrerIds || []).map((id) => String(id || '').trim()).filter(Boolean))]
  if (ids.length === 0) return 0

  const refereeToReferrer = new Map()
  for (const part of chunk(ids, 80)) {
    const { data, error } = await supabaseAdmin
      .from('referral_relations')
      .select('referrer_id,referee_id')
      .in('referrer_id', part)
    if (error) throw new Error(error.message || 'REFERRAL_PROGRAM_STATS_RELATIONS_FAILED')
    for (const row of data || []) {
      const referrerId = String(row?.referrer_id || '').trim()
      const refereeId = String(row?.referee_id || '').trim()
      if (referrerId && refereeId) refereeToReferrer.set(refereeId, referrerId)
    }
  }

  const refereeIds = [...refereeToReferrer.keys()]
  if (refereeIds.length === 0) return 0

  const active = new Set()
  for (const part of chunk(refereeIds, 80)) {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('renter_id')
      .eq('status', 'COMPLETED')
      .gte('completed_at', startIso)
      .lt('completed_at', endExclusiveIso)
      .in('renter_id', part)
    if (error) throw new Error(error.message || 'REFERRAL_PROGRAM_STATS_BOOKINGS_FAILED')
    for (const row of data || []) {
      const referrerId = refereeToReferrer.get(String(row?.renter_id || '').trim())
      if (referrerId) active.add(referrerId)
    }
  }

  return active.size
}

export async function upsertLastClosedQuarterReferralProgramStats(now = new Date()) {
  if (!supabaseAdmin) throw new Error('Database not configured')

  const q = resolveLastClosedQuarterUtc(now)
  const earnedRows = await fetchAllEarnedGuestRows(q.startIso, q.endExclusiveIso)
  const totalEarnedThb = round2(earnedRows.reduce((acc, row) => acc + Number(row?.amount_thb || 0), 0))
  const earnedReferrerIds = earnedRows.map((row) => row?.referrer_id)
  const activeAmbassadorsCount = await countActiveAmbassadors(
    earnedReferrerIds,
    q.startIso,
    q.endExclusiveIso,
  )
  const avgEarnedThb =
    activeAmbassadorsCount > 0 ? round2(totalEarnedThb / activeAmbassadorsCount) : 0

  const generatedAt = new Date().toISOString()
  const payload = {
    period_start: q.periodStart,
    period_end: q.periodEnd,
    total_earned_thb: totalEarnedThb,
    active_ambassadors_count: activeAmbassadorsCount,
    avg_earned_thb: avgEarnedThb,
    generated_at: generatedAt,
  }

  const { error } = await supabaseAdmin.from('referral_program_stats').upsert(payload, {
    onConflict: 'period_start',
  })
  if (error) throw new Error(error.message || 'REFERRAL_PROGRAM_STATS_UPSERT_FAILED')

  return {
    period: { start: q.periodStart, end: q.periodEnd, year: q.year, quarter: q.quarter },
    total: totalEarnedThb,
    count: activeAmbassadorsCount,
    avg: avgEarnedThb,
  }
}

export async function loadLatestReferralProgramStats() {
  if (!supabaseAdmin) return null
  const { data, error } = await supabaseAdmin
    .from('referral_program_stats')
    .select('period_start,period_end,total_earned_thb,active_ambassadors_count,avg_earned_thb,generated_at')
    .order('period_start', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) return null
  return data || null
}
