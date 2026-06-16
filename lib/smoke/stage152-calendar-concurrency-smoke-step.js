/**
 * Stage 152.1 — calendar capacity invariant smoke:
 * booking creation reduces min_remaining_spots; checkout-hold TTL cancel restores baseline.
 */
import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import { withFintechTestDataMeta } from '@/lib/admin/fintech-test-data-meta.js'
import { OCCUPYING_BOOKING_STATUSES } from '@/lib/booking/status-sets.js'
import { insertBookingViaAtomicRpc } from '@/lib/services/booking/booking-atomic-insert.js'
import { processExpiredAwaitingPaymentCheckouts } from '@/lib/booking/checkout-hold-expiry.js'
import { resolveListingTimeZoneFromMetadata } from '@/lib/geo/listing-timezone-ssot.js'

export const STAGE152_CAP_SMOKE_LISTING_ID = 'lst-stage152-cap-smoke'

function toDateOnly(d) {
  return d.toISOString().slice(0, 10)
}

function futureStayDates(offsetDays = 80) {
  const checkInDate = new Date()
  checkInDate.setUTCDate(checkInDate.getUTCDate() + offsetDays + (Date.now() % 14))
  const checkOutDate = new Date(checkInDate)
  checkOutDate.setUTCDate(checkOutDate.getUTCDate() + 2)
  return {
    checkIn: toDateOnly(checkInDate),
    checkOut: toDateOnly(checkOutDate),
    checkInTs: checkInDate.toISOString(),
    checkOutTs: checkOutDate.toISOString(),
  }
}

/**
 * @param {string} listingId
 * @param {string} checkIn
 * @param {string} checkOut
 * @param {number} guestsCount
 */
async function queryCapacitySnapshot(listingId, checkIn, checkOut, guestsCount = 1) {
  const { data, error } = await supabaseAdmin.rpc('batch_check_listing_availability', {
    p_listing_ids: [listingId],
    p_check_in: checkIn,
    p_check_out: checkOut,
    p_guests_count: guestsCount,
    p_occupying_statuses: [...OCCUPYING_BOOKING_STATUSES],
  })
  if (error) {
    return { ok: false, error: error.message || 'BATCH_RPC_FAILED' }
  }
  const row = (Array.isArray(data) ? data : []).find((r) => String(r?.listing_id) === listingId)
  if (!row) {
    return { ok: false, error: 'BATCH_RPC_NO_ROW' }
  }
  const minRemaining = Number(row.min_remaining_spots)
  const maxCapacity = Number(row.max_capacity)
  if (!Number.isFinite(minRemaining) || !Number.isFinite(maxCapacity)) {
    return { ok: false, error: 'BATCH_RPC_INVALID_NUMBERS' }
  }
  if (minRemaining < 0) {
    return { ok: false, error: `CAPACITY_NEGATIVE min_remaining=${minRemaining}` }
  }
  return {
    ok: true,
    minRemaining,
    maxCapacity,
    available: row.available === true,
    conflictsCount: Number(row.conflicts_count) || 0,
  }
}

async function cleanupListingBookings(listingId) {
  const { data: oldBookings } = await supabaseAdmin
    .from('bookings')
    .select('id')
    .eq('listing_id', listingId)
  const oldIds = (oldBookings || []).map((b) => b.id).filter(Boolean)
  if (!oldIds.length) return
  await supabaseAdmin.from('payment_intents').delete().in('booking_id', oldIds)
  await supabaseAdmin.from('bookings').delete().in('id', oldIds)
}

/**
 * @param {{
 *   partnerId: string,
 *   guestId: string,
 *   categoryId: string,
 *   tag?: string,
 * }} params
 */
export async function runStage152CalendarConcurrencySmokeStep(params) {
  const partnerId = String(params.partnerId || '')
  const guestId = String(params.guestId || '')
  const categoryId = String(params.categoryId || '')
  const tag = String(params.tag || `${E2E_TEST_DATA_TAG} stage152-cap-smoke`)

  if (!partnerId || !guestId || !categoryId || !supabaseAdmin) {
    return { ok: false, detail: 'missing partnerId/guestId/categoryId or Supabase' }
  }

  const listingId = STAGE152_CAP_SMOKE_LISTING_ID
  let effectiveCategoryId = categoryId
  const { data: catRows } = await supabaseAdmin.from('categories').select('id, slug')
  const housingCat = (catRows || []).find(
    (c) => !['tours', 'vehicles'].includes(String(c.slug || '').toLowerCase()),
  )
  if (housingCat?.id) effectiveCategoryId = housingCat.id

  await cleanupListingBookings(listingId)
  await supabaseAdmin.from('calendar_blocks').delete().eq('listing_id', listingId)

  const listingMetadata = withFintechTestDataMeta({
    test_data_tag: E2E_TEST_DATA_TAG,
    stage152_cap_smoke: true,
    timezone: 'Asia/Bangkok',
  })

  const { error: listingErr } = await supabaseAdmin.from('listings').upsert(
    {
      id: listingId,
      owner_id: partnerId,
      category_id: effectiveCategoryId,
      status: 'ACTIVE',
      title: `${tag} cap2 TTL smoke`,
      description: tag,
      district: 'Smoke',
      base_price_thb: 5000,
      commission_rate: 10,
      images: [],
      available: true,
      instant_booking: true,
      max_capacity: 2,
      metadata: listingMetadata,
    },
    { onConflict: 'id' },
  )
  if (listingErr) {
    return { ok: false, detail: `listing upsert: ${listingErr.message}` }
  }

  const listingTz = resolveListingTimeZoneFromMetadata(listingMetadata)
  const stay = futureStayDates(90)
  const guestsCount = 1

  const baseline = await queryCapacitySnapshot(listingId, stay.checkIn, stay.checkOut, guestsCount)
  if (!baseline.ok) {
    return { ok: false, detail: `baseline capacity: ${baseline.error}` }
  }
  if (baseline.maxCapacity !== 2) {
    return { ok: false, detail: `expected max_capacity=2, got ${baseline.maxCapacity}` }
  }
  if (baseline.minRemaining !== 2) {
    return { ok: false, detail: `expected baseline min_remaining=2, got ${baseline.minRemaining}` }
  }

  const atomic = await insertBookingViaAtomicRpc(
    {
      listing_id: listingId,
      renter_id: guestId,
      partner_id: partnerId,
      status: 'AWAITING_PAYMENT',
      check_in: stay.checkInTs,
      check_out: stay.checkOutTs,
      price_thb: 5000,
      currency: 'THB',
      price_paid: 5000,
      exchange_rate: 1,
      commission_thb: 500,
      commission_rate: 10,
      applied_commission_rate: 10,
      partner_earnings_thb: 4500,
      taxable_margin_amount: 500,
      rounding_diff_pot: 0,
      net_amount_local: 4500,
      listing_currency: 'THB',
      guest_name: 'Smoke Cap Guest',
      guest_phone: null,
      guest_email: `${guestId}@smoke.invalid`,
      special_requests: tag,
      guests_count: guestsCount,
      promo_code_used: null,
      discount_amount: 0,
      pricing_snapshot: { smoke_stage152: true },
      metadata: withFintechTestDataMeta({ test_data_tag: E2E_TEST_DATA_TAG, smoke_stage152: true }),
    },
    { guestsCount, listingTimeZone: listingTz, listingId },
  )

  if (!atomic?.bookingId) {
    return {
      ok: false,
      detail: `atomic insert: ${atomic?.error || atomic?.code || atomic?.conflictCode || 'no booking id'}`,
    }
  }

  const bookingId = String(atomic.bookingId)

  const occupied = await queryCapacitySnapshot(listingId, stay.checkIn, stay.checkOut, guestsCount)
  if (!occupied.ok) {
    await supabaseAdmin.from('bookings').delete().eq('id', bookingId)
    return { ok: false, detail: `occupied capacity: ${occupied.error}` }
  }
  if (occupied.minRemaining !== baseline.minRemaining - guestsCount) {
    await supabaseAdmin.from('bookings').delete().eq('id', bookingId)
    return {
      ok: false,
      detail: `expected min_remaining=${baseline.minRemaining - guestsCount} after hold, got ${occupied.minRemaining}`,
    }
  }

  const staleIso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  const intentId = randomUUID()
  const { error: intentErr } = await supabaseAdmin.from('payment_intents').insert({
    id: intentId,
    booking_id: bookingId,
    status: 'INITIATED',
    amount_thb: 5500,
    display_amount: 5500,
    display_currency: 'THB',
    preferred_method: 'CARD',
    allowed_methods: ['CARD'],
    initiated_at: staleIso,
    created_at: staleIso,
    metadata: { smoke_stage152: true, source: 'smoke_stage152' },
  })
  if (intentErr) {
    await supabaseAdmin.from('bookings').delete().eq('id', bookingId)
    return { ok: false, detail: `payment_intent insert: ${intentErr.message}` }
  }

  const { data: backdated, error: backdateErr } = await supabaseAdmin
    .from('bookings')
    .update({ created_at: staleIso, updated_at: staleIso })
    .eq('id', bookingId)
    .select('id, created_at, updated_at')
    .maybeSingle()
  if (backdateErr || !backdated?.id) {
    await supabaseAdmin.from('payment_intents').delete().eq('id', intentId)
    await supabaseAdmin.from('bookings').delete().eq('id', bookingId)
    return { ok: false, detail: `backdate booking: ${backdateErr?.message || 'no row'}` }
  }

  const expiry = await processExpiredAwaitingPaymentCheckouts({
    ttlMinutes: 30,
    trigger: 'smoke_stage152_checkout_hold',
    onlyBookingIds: [bookingId],
  })
  if (!expiry?.success) {
    await supabaseAdmin.from('payment_intents').delete().eq('id', intentId)
    await supabaseAdmin.from('bookings').delete().eq('id', bookingId)
    return {
      ok: false,
      detail: `checkout TTL worker: ${expiry?.error || 'failed'}`,
    }
  }
  if ((expiry.cancelled || 0) < 1) {
    await supabaseAdmin.from('payment_intents').delete().eq('id', intentId)
    await supabaseAdmin.from('bookings').delete().eq('id', bookingId)
    return {
      ok: false,
      detail: `checkout TTL cancel expected ≥1, got cancelled=${expiry?.cancelled ?? 0} skipped=${expiry?.skipped ?? 0} errors=${expiry?.errors ?? 0} scanned=${expiry?.scanned ?? 0}`,
    }
  }

  const { data: afterRow } = await supabaseAdmin
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .maybeSingle()
  if (String(afterRow?.status || '').toUpperCase() !== 'CANCELLED') {
    return {
      ok: false,
      detail: `expected CANCELLED after TTL, got ${afterRow?.status || '—'}`,
    }
  }

  const restored = await queryCapacitySnapshot(listingId, stay.checkIn, stay.checkOut, guestsCount)
  if (!restored.ok) {
    return { ok: false, detail: `restored capacity: ${restored.error}` }
  }
  if (restored.minRemaining !== baseline.minRemaining) {
    return {
      ok: false,
      detail: `expected restored min_remaining=${baseline.minRemaining}, got ${restored.minRemaining}`,
    }
  }

  await supabaseAdmin.from('payment_intents').delete().eq('id', intentId)
  await supabaseAdmin.from('bookings').delete().eq('id', bookingId)

  return {
    ok: true,
    detail: `cap ${baseline.minRemaining}→${occupied.minRemaining}→${restored.minRemaining}; TTL cancelled booking`,
  }
}

export default { runStage152CalendarConcurrencySmokeStep, STAGE152_CAP_SMOKE_LISTING_ID }
