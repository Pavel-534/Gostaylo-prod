/**
 * Stage 73.1 — лента событий команды (прямые приглашения). SSOT из БД; каналы доставки (push/outbox)
 * могут использовать те же факты — не читаем notification_outbox для UI (там нет фильтра по referrer).
 */

import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'

function parseTs(iso) {
  const n = iso ? Date.parse(iso) : NaN
  return Number.isFinite(n) ? n : 0
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseAdmin
 * @param {string} referrerId
 * @param {number} limit
 */
export async function buildReferralActivityFeed(supabaseAdmin, referrerId, limit = 15) {
  if (!supabaseAdmin || !referrerId) return []

  const { data: relations } = await supabaseAdmin
    .from('referral_relations')
    .select('referee_id, referred_at')
    .eq('referrer_id', referrerId)
    .order('referred_at', { ascending: false })

  const refereeIds = [...new Set((relations || []).map((r) => String(r.referee_id)).filter(Boolean))]
  if (!refereeIds.length) return []

  const { data: profiles } = await supabaseAdmin
    .from('profiles')
    .select('id, first_name, last_name, email')
    .in('id', refereeIds)

  const nameById = {}
  for (const p of profiles || []) {
    nameById[String(p.id)] = formatPrivacyDisplayNameForParticipant(p.first_name, p.last_name, p.email, '')
  }

  /** @type {Array<{ type: string, at: string, refereeId: string, displayName: string, meta?: Record<string, unknown> }>} */
  const raw = []

  for (const r of relations || []) {
    const rid = String(r.referee_id)
    const at = r.referred_at
    if (!rid || !at) continue
    raw.push({
      type: 'teammate_joined',
      at,
      refereeId: rid,
      displayName: nameById[rid] || '',
      meta: {},
    })
  }

  const [guestBookings, hostBookings] = await Promise.all([
    supabaseAdmin
      .from('bookings')
      .select('id, renter_id, partner_id, updated_at, created_at')
      .eq('status', 'COMPLETED')
      .in('renter_id', refereeIds),
    supabaseAdmin
      .from('bookings')
      .select('id, renter_id, partner_id, updated_at, created_at')
      .eq('status', 'COMPLETED')
      .in('partner_id', refereeIds),
  ])
  const byBookingId = new Map()
  for (const b of [...(guestBookings.data || []), ...(hostBookings.data || [])]) {
    byBookingId.set(String(b.id), b)
  }
  const bookingsRows = [...byBookingId.values()]

  /** refereeId → earliest completion timestamp + booking id */
  const firstStay = {}
  for (const b of bookingsRows || []) {
    const renter = String(b.renter_id || '')
    const partner = String(b.partner_id || '')
    const uid = refereeIds.includes(renter) ? renter : refereeIds.includes(partner) ? partner : null
    if (!uid) continue
    const tsIso = b.updated_at || b.created_at
    if (!tsIso) continue
    const ts = parseTs(tsIso)
    const cur = firstStay[uid]
    if (!cur || ts < cur.ts) firstStay[uid] = { ts, tsIso, bookingId: b.id }
  }

  const bookingIdsForBonus = [...new Set(Object.values(firstStay).map((x) => x.bookingId).filter(Boolean))]
  let bonusByBooking = {}
  if (bookingIdsForBonus.length) {
    const { data: led } = await supabaseAdmin
      .from('referral_ledger')
      .select('booking_id, amount_thb, status')
      .eq('referrer_id', referrerId)
      .in('booking_id', bookingIdsForBonus)
      .eq('status', 'earned')

    for (const row of led || []) {
      const bid = String(row.booking_id || '')
      bonusByBooking[bid] = (bonusByBooking[bid] || 0) + (Number(row.amount_thb) || 0)
    }
  }

  for (const uid of refereeIds) {
    const fs = firstStay[uid]
    if (!fs) continue
    const bonusThb = Math.round((bonusByBooking[String(fs.bookingId)] || 0) * 100) / 100
    raw.push({
      type: 'teammate_first_stay',
      at: fs.tsIso,
      refereeId: uid,
      displayName: nameById[uid] || '',
      meta: { bonusThb },
    })
  }

  const { data: listings } = await supabaseAdmin
    .from('listings')
    .select('id, owner_id, title, created_at')
    .in('owner_id', refereeIds)
    .eq('status', 'ACTIVE')

  const earliestListingByOwner = {}
  for (const L of listings || []) {
    const oid = String(L.owner_id)
    const ca = L.created_at
    if (!ca) continue
    const ts = parseTs(ca)
    const prev = earliestListingByOwner[oid]
    if (!prev || ts < prev.ts) {
      earliestListingByOwner[oid] = {
        ts,
        atIso: ca,
        title: L.title || '',
        listingId: L.id,
      }
    }
  }

  for (const uid of refereeIds) {
    const fl = earliestListingByOwner[uid]
    if (!fl) continue
    raw.push({
      type: 'teammate_new_listing',
      at: fl.atIso,
      refereeId: uid,
      displayName: nameById[uid] || '',
      meta: { listingTitle: fl.title, listingId: fl.listingId },
    })
  }

  raw.sort((a, b) => parseTs(b.at) - parseTs(a.at))

  const seen = new Set()
  const out = []
  for (const ev of raw) {
    const key = `${ev.type}:${ev.refereeId}:${ev.at}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(ev)
    if (out.length >= limit) break
  }

  return out
}
