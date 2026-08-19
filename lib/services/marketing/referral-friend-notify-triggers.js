/**
 * Stage 131.A2 — triggers for friend lifecycle ambassador notifications.
 * Does not change payout math — read-only estimates + dispatch only.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { computePublicReferralCalculatorEstimate } from '@/lib/services/marketing/referral-public-calculator.service.js'
import {
  notifyReferralFriendBooked,
  notifyReferralFriendCancelled,
  notifyReferralFriendCompleted,
} from '@/lib/services/marketing/referral-notification.service.js'
import { insertReferralTeamEvent } from '@/lib/referral/insert-referral-team-event.js'
import { getReferralRelationByReferee } from '@/lib/services/marketing/referral-payout.service.js'

const META_BOOKED = 'referral_friend_booked_notified_at'
const META_COMPLETED = 'referral_friend_completed_notified_at'
const META_CANCELLED = 'referral_friend_cancelled_notified_at'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

async function loadFriendDisplayName(friendUserId) {
  const fid = String(friendUserId || '').trim()
  if (!fid || !supabaseAdmin) return ''
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('first_name,last_name,email')
    .eq('id', fid)
    .maybeSingle()
  return formatPrivacyDisplayNameForParticipant(
    data?.first_name,
    data?.last_name,
    data?.email,
    'Friend',
  )
}

async function estimateL1ThbFromSubtotal(subtotalThb) {
  try {
    const est = await computePublicReferralCalculatorEstimate({
      subtotalThb: round2(subtotalThb),
    })
    return round2(est?.l1AmountThb)
  } catch {
    return 0
  }
}

/**
 * @param {string} bookingId
 * @param {string} metaKey
 */
async function claimFriendNotifyOnce(bookingId, metaKey) {
  const bid = String(bookingId || '').trim()
  if (!bid || !supabaseAdmin) return { claimed: false, reason: 'NO_ADMIN' }

  const { data: row, error } = await supabaseAdmin
    .from('bookings')
    .select('metadata')
    .eq('id', bid)
    .maybeSingle()
  if (error || !row) return { claimed: false, reason: 'BOOKING_NOT_FOUND' }

  const meta = row.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {}
  if (meta[metaKey]) return { claimed: false, reason: 'already_notified' }

  const now = new Date().toISOString()
  meta[metaKey] = now
  const { error: updErr } = await supabaseAdmin
    .from('bookings')
    .update({ metadata: meta, updated_at: now })
    .eq('id', bid)

  if (updErr) return { claimed: false, reason: updErr.message || 'UPDATE_FAILED' }
  return { claimed: true }
}

/**
 * @param {{ bookingId: string, renterId?: string, listingTitle?: string, subtotalThb?: number }} params
 */
export async function maybeNotifyReferralFriendBooked(params) {
  const bookingId = String(params?.bookingId || '').trim()
  if (!bookingId || !supabaseAdmin) return

  const claim = await claimFriendNotifyOnce(bookingId, META_BOOKED)
  if (!claim.claimed) return

  let renterId = String(params?.renterId || '').trim()
  let subtotalThb = round2(params?.subtotalThb)
  let listingTitle = String(params?.listingTitle || '').trim()

  if (!renterId || !subtotalThb || !listingTitle) {
    const { data: booking } = await supabaseAdmin
      .from('bookings')
      .select('id,renter_id,price_thb,listing:listings(title)')
      .eq('id', bookingId)
      .maybeSingle()
    if (!booking) return
    renterId = renterId || String(booking.renter_id || '').trim()
    subtotalThb = subtotalThb || round2(booking.price_thb)
    listingTitle = listingTitle || String(booking.listing?.title || '').trim()
  }

  const relation = await getReferralRelationByReferee(renterId)
  const ambassadorId = String(relation?.referrer_id || '').trim()
  if (!ambassadorId || ambassadorId === renterId) return

  const estimatedL1Thb = await estimateL1ThbFromSubtotal(subtotalThb)
  if (estimatedL1Thb <= 0) return

  const displayName = await loadFriendDisplayName(renterId)

  void notifyReferralFriendBooked({
    ambassadorId,
    friendUserId: renterId,
    bookingId,
    bookingSubtotalThb: subtotalThb,
    estimatedL1Thb,
    listingTitle,
    friendName: displayName,
  })

  void insertReferralTeamEvent({
    referrerId: ambassadorId,
    eventType: 'friend_booked',
    refereeId: renterId,
    metadata: {
      bookingId,
      listingTitle,
      estimatedL1Thb,
      displayName,
    },
  }).catch(() => {})
}

/**
 * @param {{
 *   bookingId: string,
 *   ambassadorId: string,
 *   friendUserId: string,
 *   listingTitle?: string,
 *   estimatedL1Thb: number,
 *   estimatedL2Thb?: number,
 *   estimatedL3Thb?: number,
 *   estimatedTotalThb?: number,
 *   friendName?: string,
 * }} params
 */
export async function maybeNotifyReferralFriendCompleted(params) {
  const bookingId = String(params?.bookingId || '').trim()
  const ambassadorId = String(params?.ambassadorId || '').trim()
  const friendUserId = String(params?.friendUserId || '').trim()
  if (!bookingId || !ambassadorId || !friendUserId || !supabaseAdmin) return

  const claim = await claimFriendNotifyOnce(bookingId, META_COMPLETED)
  if (!claim.claimed) return

  const estimatedL1Thb = round2(params.estimatedL1Thb)
  const estimatedL2Thb = round2(params.estimatedL2Thb)
  const estimatedL3Thb = round2(params.estimatedL3Thb)
  const estimatedTotalThb = round2(params.estimatedTotalThb ?? estimatedL1Thb)
  if (estimatedTotalThb <= 0 && estimatedL1Thb <= 0) return

  let listingTitle = String(params?.listingTitle || '').trim()
  if (!listingTitle) {
    const { data: bookingRow } = await supabaseAdmin
      .from('bookings')
      .select('listing:listings(title)')
      .eq('id', bookingId)
      .maybeSingle()
    listingTitle = String(bookingRow?.listing?.title || '').trim()
  }
  const friendName =
    String(params?.friendName || '').trim() || (await loadFriendDisplayName(friendUserId))

  void notifyReferralFriendCompleted({
    ambassadorId,
    friendUserId,
    bookingId,
    listingTitle,
    estimatedL1Thb,
    estimatedL2Thb,
    estimatedL3Thb,
    estimatedTotalThb,
    friendName,
  })

  void insertReferralTeamEvent({
    referrerId: ambassadorId,
    eventType: 'friend_completed',
    refereeId: friendUserId,
    metadata: {
      bookingId,
      listingTitle,
      estimatedL1Thb,
      estimatedL2Thb,
      estimatedL3Thb,
      estimatedTotalThb,
      displayName: friendName,
    },
  }).catch(() => {})
}

/**
 * @param {{ bookingId: string, renterId: string, listingTitle?: string, cancelReason?: string }} params
 */
export async function maybeNotifyReferralFriendCancelled(params) {
  const bookingId = String(params?.bookingId || '').trim()
  const renterId = String(params?.renterId || '').trim()
  if (!bookingId || !renterId || !supabaseAdmin) return

  const claim = await claimFriendNotifyOnce(bookingId, META_CANCELLED)
  if (!claim.claimed) return

  const relation = await getReferralRelationByReferee(renterId)
  const ambassadorId = String(relation?.referrer_id || '').trim()
  if (!ambassadorId || ambassadorId === renterId) return

  let listingTitle = String(params?.listingTitle || '').trim()
  if (!listingTitle) {
    const { data: bookingRow } = await supabaseAdmin
      .from('bookings')
      .select('listing:listings(title)')
      .eq('id', bookingId)
      .maybeSingle()
    listingTitle = String(bookingRow?.listing?.title || '').trim()
  }

  const friendName = await loadFriendDisplayName(renterId)
  const cancelReason = String(params?.cancelReason || '').trim()

  void notifyReferralFriendCancelled({
    ambassadorId,
    friendUserId: renterId,
    bookingId,
    listingTitle,
    friendName,
    cancelReason,
  })

  void insertReferralTeamEvent({
    referrerId: ambassadorId,
    eventType: 'friend_cancelled',
    refereeId: renterId,
    metadata: {
      bookingId,
      listingTitle,
      cancelReason,
      displayName: friendName,
    },
  }).catch(() => {})
}
