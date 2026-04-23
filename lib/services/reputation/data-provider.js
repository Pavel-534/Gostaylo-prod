import { supabaseAdmin } from '@/lib/supabase'
import { REPUTATION_SLA_MIN_SAMPLES_SCORE } from '@/lib/config/reputation-sla'
import { SUCCESS_STATUSES, incidentRecencyWeight } from './constants.js'

/** Guest reviews on all listings owned by the partner (`reviews` × `listings.owner_id`). */
export async function fetchGuestToPartnerReviewRollupForPartner(partnerId) {
  const pid = String(partnerId || '').trim()
  if (!pid || !supabaseAdmin) return { count: 0, averageRating: null }
  const { data: listings, error: lErr } = await supabaseAdmin
    .from('listings')
    .select('id')
    .eq('owner_id', pid)
    .limit(500)
  if (lErr || !listings?.length) return { count: 0, averageRating: null }
  const ids = listings.map((l) => String(l.id)).filter(Boolean)
  const { data: rows, error } = await supabaseAdmin
    .from('reviews')
    .select('rating')
    .in('listing_id', ids)
    .limit(8000)
  if (error) {
    if (!/reviews|does not exist|42P01/i.test(error.message || '')) {
      console.warn('[reputation/data-provider] guest reviews rollup', error.message)
    }
    return { count: 0, averageRating: null }
  }
  const ratings = (rows || []).map((r) => Number(r.rating)).filter((n) => Number.isFinite(n))
  if (!ratings.length) return { count: 0, averageRating: null }
  const sum = ratings.reduce((a, b) => a + b, 0)
  return { count: ratings.length, averageRating: sum / ratings.length }
}

export async function fetchPartnerAuthoredGuestReviewCount(partnerId) {
  const pid = String(partnerId || '').trim()
  if (!pid || !supabaseAdmin) return 0
  const { count, error } = await supabaseAdmin
    .from('guest_reviews')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', pid)
  if (error) {
    if (!/guest_reviews|does not exist|42P01/i.test(error.message || '')) {
      console.warn('[reputation/data-provider] guest_reviews count', error.message)
    }
    return 0
  }
  return count || 0
}

/**
 * @returns {Promise<{
 *   completedIds: string[],
 *   completedTotal: number,
 *   weightedDisputedUnits: number,
 *   bookingsWithAnyDisputeRaw: number,
 *   penaltyPointsSum: number,
 *   penaltyPointsSumWeighted: number,
 *   penaltyCount: number,
 *   penaltyCountWeighted: number,
 *   partnerDeclinedCount: number,
 *   partnerDeclinedWeighted: number,
 *   partnerInitiatedCancelCount: number,
 *   partnerCancelWeighted: number,
 * }>}
 */
export async function fetchFinancialReliabilityInputs(partnerId) {
  const pid = String(partnerId || '').trim()
  const empty = {
    completedIds: [],
    completedTotal: 0,
    weightedDisputedUnits: 0,
    bookingsWithAnyDisputeRaw: 0,
    penaltyPointsSum: 0,
    penaltyPointsSumWeighted: 0,
    penaltyCount: 0,
    penaltyCountWeighted: 0,
    partnerDeclinedCount: 0,
    partnerDeclinedWeighted: 0,
    partnerInitiatedCancelCount: 0,
    partnerCancelWeighted: 0,
  }
  if (!pid || !supabaseAdmin) return empty

  const { data: completedRows, error: cErr } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('partner_id', pid)
    .in('status', [...SUCCESS_STATUSES])
    .limit(5000)

  if (cErr) console.warn('[reputation/data-provider] completed bookings', cErr.message)

  const completedIds = (completedRows || []).map((r) => String(r.id)).filter(Boolean)
  const completedTotal = completedIds.length

  let weightedDisputedUnits = 0
  let bookingsWithAnyDisputeRaw = 0
  if (completedIds.length) {
    const { data: dRows, error: dErr } = await supabaseAdmin
      .from('disputes')
      .select('booking_id, created_at')
      .in('booking_id', completedIds)
      .neq('status', 'PENDING_MEDIATION')
      .limit(20000)
    if (dErr) {
      console.warn('[reputation/data-provider] disputes', dErr.message)
    } else {
      const byBooking = new Map()
      for (const row of dRows || []) {
        const bid = String(row.booking_id)
        const w = incidentRecencyWeight(row.created_at)
        const prev = byBooking.get(bid) || 0
        byBooking.set(bid, Math.max(prev, w))
      }
      bookingsWithAnyDisputeRaw = byBooking.size
      weightedDisputedUnits = [...byBooking.values()].reduce((a, v) => a + v, 0)
    }
  }

  const { data: penRows, error: pErr } = await supabaseAdmin
    .from('dispute_penalties')
    .select('points, created_at')
    .eq('target_user_id', pid)

  if (pErr) console.warn('[reputation/data-provider] penalties', pErr.message)

  let penaltyPointsSum = 0
  let penaltyPointsSumWeighted = 0
  let penaltyCountWeighted = 0
  for (const r of penRows || []) {
    const pts = Number.isFinite(Number(r.points)) ? Number(r.points) : 0
    const w = incidentRecencyWeight(r.created_at)
    penaltyPointsSum += pts
    penaltyPointsSumWeighted += pts * w
    penaltyCountWeighted += w
  }
  const penaltyCount = penRows?.length || 0

  const { data: declRows, error: decErr } = await supabaseAdmin
    .from('bookings')
    .select('id, updated_at, created_at')
    .eq('partner_id', pid)
    .eq('status', 'DECLINED')
    .limit(2000)

  if (decErr) console.warn('[reputation/data-provider] declined', decErr.message)

  let partnerDeclinedWeighted = 0
  for (const r of declRows || []) {
    const ts = r.updated_at || r.created_at
    partnerDeclinedWeighted += incidentRecencyWeight(ts)
  }
  const partnerDeclinedCount = declRows?.length || 0

  const { data: cancelRows, error: canErr } = await supabaseAdmin
    .from('bookings')
    .select('id, metadata, updated_at')
    .eq('partner_id', pid)
    .eq('status', 'CANCELLED')
    .limit(2000)

  if (canErr) console.warn('[reputation/data-provider] cancelled', canErr.message)

  let partnerInitiatedCancelCount = 0
  let partnerCancelWeighted = 0
  for (const b of cancelRows || []) {
    if (String(b?.metadata?.cancelled_by_user_id || '') !== pid) continue
    partnerInitiatedCancelCount += 1
    const ts = b?.metadata?.cancelled_at || b?.metadata?.cancelledAt || b.updated_at
    partnerCancelWeighted += incidentRecencyWeight(ts)
  }

  return {
    completedIds,
    completedTotal,
    weightedDisputedUnits,
    bookingsWithAnyDisputeRaw,
    penaltyPointsSum,
    penaltyPointsSumWeighted,
    penaltyCount,
    penaltyCountWeighted,
    partnerDeclinedCount,
    partnerDeclinedWeighted,
    partnerInitiatedCancelCount,
    partnerCancelWeighted,
  }
}

/**
 * Merge 12m tooltip metrics into existing trust objects (mutates map values).
 * @param {string[]} partnerIds
 * @param {Map<string, object>} trustMap
 */
export async function merge12mTooltipBatch(partnerIds, trustMap) {
  const unique = [...new Set(partnerIds.filter(Boolean).map(String))].slice(0, 120)
  if (!unique.length || !supabaseAdmin) return

  const since = new Date()
  since.setMonth(since.getMonth() - 12)
  const sinceIso = since.toISOString()

  const { data: b12, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('id, partner_id, check_out')
    .in('partner_id', unique)
    .in('status', [...SUCCESS_STATUSES])
    .gte('check_out', sinceIso)
    .limit(12000)

  if (bErr) {
    console.warn('[reputation/data-provider] merge12m bookings', bErr.message)
    return
  }

  const byPartner = new Map()
  const allIds = []
  for (const b of b12 || []) {
    const pid = String(b.partner_id)
    if (!byPartner.has(pid)) byPartner.set(pid, [])
    byPartner.get(pid).push(b)
    allIds.push(String(b.id))
  }

  const disputed = new Set()
  if (allIds.length) {
    const chunk = 500
    for (let i = 0; i < allIds.length; i += chunk) {
      const slice = allIds.slice(i, i + chunk)
      const { data: drows, error: dErr } = await supabaseAdmin
        .from('disputes')
        .select('booking_id')
        .in('booking_id', slice)
        .neq('status', 'PENDING_MEDIATION')
        .limit(20000)
      if (dErr) {
        console.warn('[reputation/data-provider] merge12m disputes', dErr.message)
        break
      }
      for (const r of drows || []) disputed.add(String(r.booking_id))
    }
  }

  const { data: decl12, error: d12Err } = await supabaseAdmin
    .from('bookings')
    .select('partner_id')
    .in('partner_id', unique)
    .eq('status', 'DECLINED')
    .gte('updated_at', sinceIso)
    .limit(8000)

  if (d12Err) console.warn('[reputation/data-provider] merge12m declined', d12Err.message)

  const declCount = {}
  for (const r of decl12 || []) {
    const pid = String(r.partner_id)
    declCount[pid] = (declCount[pid] || 0) + 1
  }

  const { data: canRows, error: c12Err } = await supabaseAdmin
    .from('bookings')
    .select('partner_id, metadata')
    .in('partner_id', unique)
    .eq('status', 'CANCELLED')
    .limit(8000)

  if (c12Err) console.warn('[reputation/data-provider] merge12m cancel scan', c12Err.message)

  const canCount = {}
  for (const r of canRows || []) {
    const pid = String(r.partner_id)
    if (String(r?.metadata?.cancelled_by_user_id || '') !== pid) continue
    const ca = r?.metadata?.cancelled_at || r?.metadata?.cancelledAt
    if (!ca || new Date(ca) < new Date(sinceIso)) continue
    canCount[pid] = (canCount[pid] || 0) + 1
  }

  for (const pid of unique) {
    const t = trustMap.get(pid)
    if (!t) continue
    const arr = byPartner.get(pid) || []
    let clean = 0
    for (const b of arr) {
      if (!disputed.has(String(b.id))) clean += 1
    }
    const completedStays12m = arr.length
    const cancellations12m = (declCount[pid] || 0) + (canCount[pid] || 0)
    const cleanStayPercent12m =
      completedStays12m > 0 ? Math.round((clean / completedStays12m) * 100) : null
    t.tooltip = {
      cancellations12m,
      completedStays12m,
      cleanStays12m: clean,
      cleanStayPercent12m,
    }
    const slaN = Number(t.initialResponseSampleCount30d) || 0
    if (
      slaN >= REPUTATION_SLA_MIN_SAMPLES_SCORE &&
      t.avgInitialResponseMinutes30d != null &&
      Number.isFinite(t.avgInitialResponseMinutes30d)
    ) {
      t.tooltip.avgResponseMinutes30d = t.avgInitialResponseMinutes30d
      t.tooltip.responseSampleCount30d = slaN
    }
  }
}
