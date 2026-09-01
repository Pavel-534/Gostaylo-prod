/**
 * Stage 202.22 — Qualified host definition for Local Leader tier + quests.
 * Not the same as `ReferralTierSyncService.countDirectPartnersInvited` (PARTNER role only).
 *
 * Qualified host = direct L1 invite (referral_relations) who has either:
 * - referral_ledger host_activation for this referrer, or
 * - ≥1 booking with status COMPLETED as partner_id (host).
 */

const MS_30D = 30 * 24 * 60 * 60 * 1000

function round2(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * @param {string | Date | null | undefined} iso
 */
function parseMs(iso) {
  if (!iso) return null
  const t = Date.parse(String(iso))
  return Number.isFinite(t) ? t : null
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 */
export async function loadQualifiedHostSets(supabaseAdmin, referrerId) {
  const uid = String(referrerId || '').trim()
  const empty = {
    refereeIds: [],
    referredAtByReferee: {},
    qualifiedRefereeIds: new Set(),
    qualifiedLast30dRefereeIds: new Set(),
  }
  if (!supabaseAdmin || !uid) return empty

  const { data: relations, error: relErr } = await supabaseAdmin
    .from('referral_relations')
    .select('referee_id, referred_at')
    .eq('referrer_id', uid)

  if (relErr || !relations?.length) return empty

  const referredAtByReferee = {}
  const refereeIds = []
  const seen = new Set()
  for (const row of relations) {
    const rid = String(row?.referee_id || '').trim()
    if (!rid || seen.has(rid)) continue
    seen.add(rid)
    refereeIds.push(rid)
    referredAtByReferee[rid] = row?.referred_at || null
  }
  if (!refereeIds.length) return empty

  const nowMs = Date.now()
  const windowStartMs = nowMs - MS_30D

  const [hostActivationRes, completedHostRes] = await Promise.all([
    supabaseAdmin
      .from('referral_ledger')
      .select('referee_id, earned_at, created_at')
      .eq('referrer_id', uid)
      .eq('referral_type', 'host_activation')
      .in('referee_id', refereeIds),
    supabaseAdmin
      .from('bookings')
      .select('partner_id, updated_at, created_at')
      .eq('status', 'COMPLETED')
      .in('partner_id', refereeIds),
  ])

  const qualificationMsByReferee = {}

  for (const row of hostActivationRes.data || []) {
    const rid = String(row?.referee_id || '').trim()
    if (!rid) continue
    const ms = parseMs(row?.earned_at) ?? parseMs(row?.created_at)
    if (ms != null) {
      qualificationMsByReferee[rid] =
        qualificationMsByReferee[rid] != null ? Math.min(qualificationMsByReferee[rid], ms) : ms
    } else {
      qualificationMsByReferee[rid] = qualificationMsByReferee[rid] ?? nowMs
    }
  }

  for (const row of completedHostRes.data || []) {
    const rid = String(row?.partner_id || '').trim()
    if (!rid) continue
    const ms = parseMs(row?.updated_at) ?? parseMs(row?.created_at)
    if (ms != null) {
      qualificationMsByReferee[rid] =
        qualificationMsByReferee[rid] != null ? Math.min(qualificationMsByReferee[rid], ms) : ms
    } else {
      qualificationMsByReferee[rid] = qualificationMsByReferee[rid] ?? nowMs
    }
  }

  const qualifiedRefereeIds = new Set(Object.keys(qualificationMsByReferee))
  const qualifiedLast30dRefereeIds = new Set()

  for (const rid of qualifiedRefereeIds) {
    const qMs = qualificationMsByReferee[rid]
    const referredMs = parseMs(referredAtByReferee[rid])
    const inWindow =
      (qMs != null && qMs >= windowStartMs) || (referredMs != null && referredMs >= windowStartMs)
    if (inWindow) qualifiedLast30dRefereeIds.add(rid)
  }

  return {
    refereeIds,
    referredAtByReferee,
    qualifiedRefereeIds,
    qualifiedLast30dRefereeIds,
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 */
export async function countQualifiedHosts(supabaseAdmin, referrerId) {
  const sets = await loadQualifiedHostSets(supabaseAdmin, referrerId)
  return sets.qualifiedRefereeIds.size
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} userId
 */
export async function countCompletedBookingsAsHost(supabaseAdmin, userId) {
  const uid = String(userId || '').trim()
  if (!supabaseAdmin || !uid) return 0
  const { count, error } = await supabaseAdmin
    .from('bookings')
    .select('id', { head: true, count: 'exact' })
    .eq('partner_id', uid)
    .eq('status', 'COMPLETED')
  if (error) return 0
  return Math.max(0, Number(count) || 0)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 */
export async function countBookingsViaReferralLink(supabaseAdmin, referrerId) {
  const uid = String(referrerId || '').trim()
  if (!supabaseAdmin || !uid) return 0

  const { data: relations } = await supabaseAdmin
    .from('referral_relations')
    .select('referee_id')
    .eq('referrer_id', uid)

  const refereeIds = [...new Set((relations || []).map((r) => String(r.referee_id || '').trim()).filter(Boolean))]
  if (!refereeIds.length) return 0

  const { count, error } = await supabaseAdmin
    .from('bookings')
    .select('id', { head: true, count: 'exact' })
    .eq('status', 'COMPLETED')
    .in('renter_id', refereeIds)

  if (error) return 0
  return Math.max(0, Number(count) || 0)
}

let warnedRpcMissing = false

/**
 * Legacy Node reduce — fallback when referral_earned_thb_total RPC is not deployed.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 */
export async function sumReferralEarnedThbLegacyReduce(supabaseAdmin, referrerId) {
  const uid = String(referrerId || '').trim()
  if (!supabaseAdmin || !uid) return 0

  const { data, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('amount_thb')
    .eq('referrer_id', uid)
    .in('status', ['earned', 'earned_held'])

  if (error) return 0
  let sum = 0
  for (const row of data || []) sum += Number(row?.amount_thb) || 0
  return round2(sum)
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 */
export async function sumReferralEarnedThb(supabaseAdmin, referrerId) {
  const uid = String(referrerId || '').trim()
  if (!supabaseAdmin || !uid) return 0

  const { data, error } = await supabaseAdmin.rpc('referral_earned_thb_total', {
    p_referrer_id: uid,
  })

  if (!error) {
    return round2(data)
  }

  const msg = String(error.message || '')
  const rpcMissing =
    msg.includes('referral_earned_thb_total') ||
    msg.includes('Could not find the function') ||
    msg.includes('schema cache')

  if (rpcMissing) {
    if (!warnedRpcMissing) {
      warnedRpcMissing = true
      console.warn('[qualified-host-metrics] referral_earned_thb_total RPC missing — legacy Node reduce')
    }
    return sumReferralEarnedThbLegacyReduce(supabaseAdmin, uid)
  }

  return 0
}

/**
 * @param {object | null | undefined} metadata
 */
export function isLocalLeaderRegionAssigned(metadata) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {}
  const regionId = meta.local_leader_region_id
  if (regionId == null) return false
  const s = String(regionId).trim()
  return s.length > 0
}
