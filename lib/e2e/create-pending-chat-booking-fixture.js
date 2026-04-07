/**
 * Создаёт PENDING-бронь + чат для E2E (Playwright).
 * Вызывается только из защищённого API при совпадении E2E_FIXTURE_SECRET.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { BookingService, resolveListingCategorySlug } from '@/lib/services/booking.service'
import { PricingService } from '@/lib/services/pricing.service'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'

const FIXTURE_TAG = `${E2E_TEST_DATA_TAG} [E2E_PENDING_CHAT_FIXTURE]`

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
    .select('id,max_capacity,base_price_thb,category_id')
    .eq('owner_id', partnerId)
    .eq('status', 'ACTIVE')
    .limit(8)

  if (lErr || !listings?.length) {
    throw new Error('No listing found for partner — add at least one listing for the E2E partner account')
  }

  const guestName =
    [renterProfile.first_name, renterProfile.last_name].filter(Boolean).join(' ').trim() ||
    `${E2E_TEST_DATA_TAG} E2E Guest`
  const guestEmail = renterProfile.email || re
  const guestPhone = String(renterProfile.phone || '').replace(/\D/g, '').slice(0, 15) || '0000000000'

  const start = new Date()
  start.setUTCDate(start.getUTCDate() + 90)
  const baseCheckIn = start.toISOString().slice(0, 10)

  let lastError = 'unknown'
  for (const listingRow of listings) {
    const listingId = listingRow.id
    const maxCap = Math.max(1, parseInt(listingRow.max_capacity, 10) || 1)
    const guestsCount = Math.min(2, maxCap)
    const listingCategorySlug = await resolveListingCategorySlug(listingRow.category_id)

    for (let w = 0; w < 24; w++) {
      const checkIn = isoAddDays(baseCheckIn, w * 5)
      const checkOut = isoAddDays(checkIn, 3)
      const pc = await PricingService.calculateBookingPrice(
        listingId,
        checkIn,
        checkOut,
        parseFloat(listingRow.base_price_thb),
        { listingCategorySlug, guestsCount },
      )
      if (pc.error) {
        lastError = pc.error
        continue
      }
      const clientQuotedSubtotalThb = Math.round(Number(pc.totalPrice))
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
        guestsCount,
        clientQuotedSubtotalThb,
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
  }

  throw new Error(
    `Could not create PENDING booking after retries (calendar conflicts?). Last error: ${lastError}`,
  )
}
