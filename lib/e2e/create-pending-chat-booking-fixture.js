/**
 * Создаёт PENDING-бронь + чат для E2E (Playwright).
 * Вызывается только из защищённого API при совпадении E2E_FIXTURE_SECRET.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { BookingService } from '@/lib/services/booking.service'

const FIXTURE_TAG = '[E2E_PENDING_CHAT_FIXTURE]'

function isoAddDays(yyyyMmDd, deltaDays) {
  const d = new Date(`${yyyyMmDd}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

/**
 * @param {{ partnerEmail: string, renterEmail: string }} opts
 * @returns {Promise<{ conversationId: string, bookingId: string, listingId: string }>}
 */
export async function createPendingChatBookingFixture({ partnerEmail, renterEmail }) {
  if (!supabaseAdmin) {
    throw new Error('supabaseAdmin not configured')
  }

  const pe = String(partnerEmail || '').toLowerCase().trim()
  const re = String(renterEmail || '').toLowerCase().trim()
  if (!pe || !re) {
    throw new Error('partnerEmail and renterEmail required')
  }

  const { data: partnerProfile, error: pErr } = await supabaseAdmin
    .from('profiles')
    .select('id,email,first_name,last_name')
    .ilike('email', pe)
    .maybeSingle()

  if (pErr || !partnerProfile?.id) {
    throw new Error(`Partner profile not found for email ${partnerEmail}`)
  }

  const { data: renterProfile, error: rErr } = await supabaseAdmin
    .from('profiles')
    .select('id,email,first_name,last_name,phone')
    .ilike('email', re)
    .maybeSingle()

  if (rErr || !renterProfile?.id) {
    throw new Error(`Renter profile not found for email ${renterEmail}`)
  }

  const partnerId = partnerProfile.id
  const renterId = renterProfile.id

  const { data: listings, error: lErr } = await supabaseAdmin
    .from('listings')
    .select('id')
    .eq('owner_id', partnerId)
    .limit(1)

  if (lErr || !listings?.length) {
    throw new Error('No listing found for partner — add at least one listing for the E2E partner account')
  }

  const listingId = listings[0].id
  const guestName = [renterProfile.first_name, renterProfile.last_name].filter(Boolean).join(' ').trim() || 'E2E Guest'
  const guestEmail = renterProfile.email || re
  const guestPhone = String(renterProfile.phone || '').replace(/\D/g, '').slice(0, 15) || '0000000000'

  const start = new Date()
  start.setUTCDate(start.getUTCDate() + 50)
  const baseCheckIn = start.toISOString().slice(0, 10)

  let lastError = 'unknown'
  for (let w = 0; w < 12; w++) {
    const checkIn = isoAddDays(baseCheckIn, w * 5)
    const checkOut = isoAddDays(checkIn, 3)
    const result = await BookingService.createBooking({
      listingId,
      renterId,
      checkIn,
      checkOut,
      guestName,
      guestPhone,
      guestEmail,
      specialRequests: FIXTURE_TAG,
      currency: 'THB',
      guestsCount: 2,
    })

    if (!result.error && result.booking?.id && result.conversationId) {
      return {
        conversationId: result.conversationId,
        bookingId: result.booking.id,
        listingId,
      }
    }
    lastError = result.error || 'createBooking failed'
  }

  throw new Error(
    `Could not create PENDING booking after retries (calendar conflicts?). Last error: ${lastError}`,
  )
}
