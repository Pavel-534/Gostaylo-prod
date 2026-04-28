/**
 * Запись событий ленты «Моя команда» (SSOT: `referral_team_events`).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { formatPrivacyDisplayNameForParticipant } from '@/lib/utils/name-formatter'
import { insertReferralTeamEvent } from '@/lib/referral/insert-referral-team-event'

const REFERRER_BONUS = 'bonus'
const EARNED = 'earned'
const GUEST_BOOKING = 'guest_booking'

/**
 * После distribute (гостевая бронь): бонусы рефереру + первая поездка гостя.
 */
export async function recordReferralTeamFeedAfterGuestBooking(bookingId) {
  if (!supabaseAdmin) return
  const bid = String(bookingId || '').trim()
  if (!bid) return

  const { data: booking } = await supabaseAdmin
    .from('bookings')
    .select('id,renter_id,status,updated_at,created_at')
    .eq('id', bid)
    .maybeSingle()
  if (!booking || String(booking.status || '').toUpperCase() !== 'COMPLETED') return

  const renterId = String(booking.renter_id || '').trim()
  if (!renterId) return

  const { data: relation } = await supabaseAdmin
    .from('referral_relations')
    .select('referrer_id,referee_id')
    .eq('referee_id', renterId)
    .maybeSingle()
  const directReferrer = relation?.referrer_id ? String(relation.referrer_id) : null

  const { count: otherCompleted } = await supabaseAdmin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('renter_id', renterId)
    .eq('status', 'COMPLETED')
    .neq('id', bid)

  const isFirstStay = !otherCompleted

  const { data: ledgerRows } = await supabaseAdmin
    .from('referral_ledger')
    .select('id,referrer_id,referee_id,amount_thb,type,status,referral_type,booking_id')
    .eq('booking_id', bid)
    .eq('status', EARNED)

  for (const row of ledgerRows || []) {
    const amount = Number(row.amount_thb) || 0
    const refId = String(row.referrer_id || '').trim()
    if (!refId || amount <= 0) continue
    if (String(row.type || '').toLowerCase() !== REFERRER_BONUS) continue

    await insertReferralTeamEvent({
      referrerId: refId,
      eventType: 'referral_bonus_earned',
      refereeId: row.referee_id ? String(row.referee_id) : renterId,
      metadata: {
        amountThb: Math.round(amount * 100) / 100,
        bookingId: bid,
        referralType: row.referral_type || null,
      },
    }).catch(() => {})

    if (
      isFirstStay &&
      directReferrer &&
      refId === directReferrer &&
      String(row.referral_type || '') === GUEST_BOOKING
    ) {
      const { data: existing } = await supabaseAdmin
        .from('referral_team_events')
        .select('id')
        .eq('referrer_id', directReferrer)
        .eq('referee_id', renterId)
        .eq('event_type', 'teammate_first_stay')
        .limit(1)
      if (!existing?.length) {
        const { data: prof } = await supabaseAdmin
          .from('profiles')
          .select('first_name,last_name,email')
          .eq('id', renterId)
          .maybeSingle()
        const displayName = formatPrivacyDisplayNameForParticipant(
          prof?.first_name,
          prof?.last_name,
          prof?.email,
          '',
        )
        await insertReferralTeamEvent({
          referrerId: directReferrer,
          eventType: 'teammate_first_stay',
          refereeId: renterId,
          metadata: {
            bonusThb: Math.round(amount * 100) / 100,
            bookingId: bid,
            displayName,
          },
        }).catch(() => {})
      }
    }
  }
}

/**
 * После host activation — строки ledger уже вставлены.
 * @param {string} bookingId
 * @param {Array<{ referrer_id: string, referee_id: string, amount_thb: number, referral_type?: string }>} ledgerRows
 */
export async function recordReferralTeamFeedAfterHostActivation(bookingId, ledgerRows) {
  if (!supabaseAdmin || !Array.isArray(ledgerRows) || !ledgerRows.length) return
  const bid = String(bookingId || '').trim()
  for (const row of ledgerRows) {
    const refId = String(row.referrer_id || '').trim()
    const refereeId = String(row.referee_id || '').trim()
    const amount = Number(row.amount_thb) || 0
    if (!refId || amount <= 0) continue
    await insertReferralTeamEvent({
      referrerId: refId,
      eventType: 'referral_bonus_earned',
      refereeId: refereeId || null,
      metadata: {
        amountThb: Math.round(amount * 100) / 100,
        bookingId: bid,
        referralType: 'host_activation',
      },
    }).catch(() => {})
  }
}

/**
 * Первый активный листинг партнёра в сети (после approve модерации).
 */
export async function recordTeammateNewListingIfFirst(listingId) {
  if (!supabaseAdmin) return
  const lid = String(listingId || '').trim()
  if (!lid) return

  const { data: listing } = await supabaseAdmin
    .from('listings')
    .select('id,owner_id,title,status')
    .eq('id', lid)
    .maybeSingle()
  if (!listing || String(listing.status || '').toUpperCase() !== 'ACTIVE') return

  const ownerId = String(listing.owner_id || '').trim()
  if (!ownerId) return

  const { count: otherActive } = await supabaseAdmin
    .from('listings')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', ownerId)
    .eq('status', 'ACTIVE')
    .neq('id', lid)

  if ((Number(otherActive) || 0) > 0) return

  const { data: relation } = await supabaseAdmin
    .from('referral_relations')
    .select('referrer_id')
    .eq('referee_id', ownerId)
    .maybeSingle()
  const referrerId = relation?.referrer_id ? String(relation.referrer_id) : ''
  if (!referrerId) return

  const { data: dup } = await supabaseAdmin
    .from('referral_team_events')
    .select('id')
    .eq('referrer_id', referrerId)
    .eq('referee_id', ownerId)
    .eq('event_type', 'teammate_new_listing')
    .limit(1)
  if (dup?.length) return

  const { data: prof } = await supabaseAdmin
    .from('profiles')
    .select('first_name,last_name,email')
    .eq('id', ownerId)
    .maybeSingle()
  const displayName = formatPrivacyDisplayNameForParticipant(
    prof?.first_name,
    prof?.last_name,
    prof?.email,
    '',
  )

  await insertReferralTeamEvent({
    referrerId,
    eventType: 'teammate_new_listing',
    refereeId: ownerId,
    metadata: {
      listingTitle: String(listing.title || '').slice(0, 200),
      listingId: lid,
      displayName,
    },
  }).catch(() => {})
}
