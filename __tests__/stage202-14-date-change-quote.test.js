/**
 * Stage 202.14 — date-change quote (old/new/delta) + route presence.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  nightsBetweenStay,
  resolveDateChangeMode,
} from '../lib/services/booking/date-change-quote-helpers.js'
import { expectedPaymentIntentAmountThbFromBooking } from '../lib/services/booking/checkout-promo-amounts.js'
import { resolveCheckoutChargeTotalThb } from '../lib/pricing/price-truth.js'

const root = process.cwd()

function resolveBookingLockedGuestTotalThb(booking) {
  const fromIntent = expectedPaymentIntentAmountThbFromBooking(booking)
  if (Number.isFinite(fromIntent) && fromIntent > 0) return fromIntent
  const fromCols = resolveCheckoutChargeTotalThb(booking)
  return Number.isFinite(fromCols) && fromCols > 0 ? fromCols : 0
}

test('nightsBetweenStay counts calendar nights', () => {
  assert.equal(nightsBetweenStay('2026-09-01', '2026-09-04'), 3)
  assert.equal(nightsBetweenStay('2026-09-01', '2026-09-01'), null)
  assert.equal(nightsBetweenStay('bad', '2026-09-04'), null)
})

test('resolveDateChangeMode classifies extension / shorten / reschedule', () => {
  assert.equal(
    resolveDateChangeMode({
      currentCheckIn: '2026-09-01',
      currentCheckOut: '2026-09-05',
      proposedCheckIn: '2026-09-01',
      proposedCheckOut: '2026-09-08',
    }),
    'extension',
  )
  assert.equal(
    resolveDateChangeMode({
      currentCheckIn: '2026-09-01',
      currentCheckOut: '2026-09-05',
      proposedCheckIn: '2026-09-01',
      proposedCheckOut: '2026-09-03',
    }),
    'shorten',
  )
  assert.equal(
    resolveDateChangeMode({
      currentCheckIn: '2026-09-01',
      currentCheckOut: '2026-09-05',
      proposedCheckIn: '2026-09-02',
      proposedCheckOut: '2026-09-06',
    }),
    'reschedule',
  )
  assert.equal(
    resolveDateChangeMode({
      currentCheckIn: '2026-09-01',
      currentCheckOut: '2026-09-05',
      proposedCheckIn: '2026-09-01',
      proposedCheckOut: '2026-09-05',
    }),
    'unchanged',
  )
  assert.equal(
    resolveDateChangeMode({
      currentCheckIn: '2026-09-01',
      currentCheckOut: '2026-09-05',
      proposedCheckIn: '2026-09-05',
      proposedCheckOut: '2026-09-01',
    }),
    'invalid',
  )
})

test('resolveBookingLockedGuestTotalThb uses price+commission+pot', () => {
  const thb = resolveBookingLockedGuestTotalThb({
    price_thb: 1000,
    commission_thb: 100,
    rounding_diff_pot: 0,
  })
  assert.equal(thb, 1100)
})

test('GET date-change-quote route exists and is read-only', () => {
  const p = join(root, 'app/api/v2/bookings/[id]/date-change-quote/route.js')
  assert.equal(existsSync(p), true)
  const src = readFileSync(p, 'utf8')
  assert.match(src, /export async function GET/)
  assert.match(src, /computeDateChangeQuoteForBooking/)
  assert.doesNotMatch(src, /\.update\(/)
  assert.doesNotMatch(src, /export async function POST/)
})

test('date-change-quote service marks applySupported false', () => {
  const src = readFileSync(join(root, 'lib/services/booking/date-change-quote.js'), 'utf8')
  assert.match(src, /applySupported:\s*false/)
  assert.match(src, /suggestedChargeThb/)
  assert.match(src, /computeListingBookingQuote/)
})

test('chat invoice extension prefills from date-change-quote', () => {
  const src = readFileSync(join(root, 'components/chat-invoice.jsx'), 'utf8')
  assert.match(src, /date-change-quote/)
  assert.match(src, /suggestedChargeThb/)
})
