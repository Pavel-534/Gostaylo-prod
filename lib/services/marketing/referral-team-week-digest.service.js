import { supabaseAdmin } from '@/lib/supabase'
import { notifyReferralTeamWeeklyDigest } from '@/lib/services/marketing/referral-notification.service.js'

const DIGEST_META_KEY = 'referral_week_digest_week_id'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function getLastWeekWindowUtc() {
  const end = new Date()
  end.setUTCHours(0, 0, 0, 0)
  const start = new Date(end.getTime() - 7 * 24 * 3600000)
  const weekId = start.toISOString().slice(0, 10)
  return { startIso: start.toISOString(), endIso: end.toISOString(), weekId }
}

export async function runReferralTeamWeekDigest() {
  if (!supabaseAdmin) return { sent: 0, users: 0, skippedZero: 0, error: 'no_db' }

  const { startIso, endIso, weekId } = getLastWeekWindowUtc()
  const { data: rows, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('referrer_id,ledger_depth,amount_thb,status,type')
    .in('ledger_depth', [2, 3])
    .eq('type', 'guest_booking')
    .in('status', ['pending', 'earned', 'earned_held'])
    .gte('created_at', startIso)
    .lt('created_at', endIso)
  if (error) throw error

  const byUser = new Map()
  for (const row of rows || []) {
    const userId = String(row?.referrer_id || '').trim()
    if (!userId) continue
    const depth = Number(row?.ledger_depth)
    const amount = round2(row?.amount_thb)
    if (amount <= 0) continue
    const cur = byUser.get(userId) || { l2Thb: 0, l3Thb: 0 }
    if (depth === 2) cur.l2Thb = round2(cur.l2Thb + amount)
    if (depth === 3) cur.l3Thb = round2(cur.l3Thb + amount)
    byUser.set(userId, cur)
  }

  let sent = 0
  let skippedZero = 0
  for (const [userId, sums] of byUser.entries()) {
    const l2Thb = round2(sums.l2Thb)
    const l3Thb = round2(sums.l3Thb)
    const totalThb = round2(l2Thb + l3Thb)
    if (totalThb <= 0) {
      skippedZero += 1
      continue
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', userId)
      .maybeSingle()
    const meta = profile?.metadata && typeof profile.metadata === 'object' ? profile.metadata : {}
    if (String(meta[DIGEST_META_KEY] || '') === weekId) continue

    await notifyReferralTeamWeeklyDigest({
      userId,
      weekId,
      totalThb,
      l1Thb: 0,
      l2Thb,
      l3Thb,
      networkLevelMode: 'l2_l3',
    })
    await supabaseAdmin
      .from('profiles')
      .update({ metadata: { ...meta, [DIGEST_META_KEY]: weekId } })
      .eq('id', userId)
    sent += 1
  }

  return { sent, users: byUser.size, skippedZero, weekId, startIso, endIso }
}

