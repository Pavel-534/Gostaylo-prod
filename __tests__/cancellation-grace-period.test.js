/**
 * Stage 202.16 — guest cancel grace period (15 min post-capture + ≥24h before check-in).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  computeRefundGuestThbFromCancellation,
  getGuestCancelGraceMinutes,
  getGuestCancelGraceMinHoursBeforeCheckIn,
  guestRefundPercentFromPolicy,
  qualifiesForGuestCancelGracePeriod,
  resolvePaymentCapturedAtFromIntent,
} from '../lib/cancellation-refund-rules.js'

const root = process.cwd()

test('resolvePaymentCapturedAtFromIntent prefers confirmed_at', () => {
  const at = resolvePaymentCapturedAtFromIntent({
    confirmed_at: '2026-09-01T12:00:00.000Z',
    metadata: { paid_event: { at: '2026-09-01T11:00:00.000Z' } },
  })
  assert.equal(at?.toISOString(), '2026-09-01T12:00:00.000Z')
})

test('resolvePaymentCapturedAtFromIntent falls back to metadata.paid_event.at', () => {
  const at = resolvePaymentCapturedAtFromIntent({
    metadata: { paid_event: { at: '2026-09-01T11:30:00.000Z' } },
  })
  assert.equal(at?.toISOString(), '2026-09-01T11:30:00.000Z')
})

test('qualifiesForGuestCancelGracePeriod: 10 min + 48h before check-in', () => {
  const captured = new Date('2026-09-01T12:00:00.000Z')
  const cancelledAt = new Date('2026-09-01T12:10:00.000Z')
  assert.equal(
    qualifiesForGuestCancelGracePeriod({
      hoursBeforeCheckIn: 48,
      paymentCapturedAt: captured,
      cancelledAt,
      graceMinutes: 15,
      minHoursBeforeCheckIn: 24,
    }),
    true,
  )
})

test('qualifiesForGuestCancelGracePeriod: 20 min after capture → false', () => {
  const captured = new Date('2026-09-01T12:00:00.000Z')
  const cancelledAt = new Date('2026-09-01T12:20:00.000Z')
  assert.equal(
    qualifiesForGuestCancelGracePeriod({
      hoursBeforeCheckIn: 48,
      paymentCapturedAt: captured,
      cancelledAt,
      graceMinutes: 15,
      minHoursBeforeCheckIn: 24,
    }),
    false,
  )
})

test('qualifiesForGuestCancelGracePeriod: <24h before check-in → false', () => {
  const captured = new Date('2026-09-01T12:00:00.000Z')
  const cancelledAt = new Date('2026-09-01T12:05:00.000Z')
  assert.equal(
    qualifiesForGuestCancelGracePeriod({
      hoursBeforeCheckIn: 12,
      paymentCapturedAt: captured,
      cancelledAt,
      graceMinutes: 15,
      minHoursBeforeCheckIn: 24,
    }),
    false,
  )
})

test('computeRefundGuestThbFromCancellation grace overrides strict 0%', () => {
  const captured = new Date('2026-09-10T10:00:00.000Z')
  const cancelledAt = new Date('2026-09-10T10:08:00.000Z')
  const checkIn = '2026-09-15T14:00:00.000Z'
  assert.equal(guestRefundPercentFromPolicy('strict', 120), 0)

  const result = computeRefundGuestThbFromCancellation(
    { cancellation_policy: 'strict' },
    checkIn,
    1000,
    cancelledAt,
    { paymentCapturedAt: captured, graceMinutes: 15, minHoursBeforeCheckIn: 24 },
  )
  assert.equal(result.percent, 100)
  assert.equal(result.refundGuestThb, 1000)
  assert.equal(result.refundReason, 'grace_period')
  assert.equal(result.gracePeriodActive, true)
})

test('computeRefundGuestThbFromCancellation without capture uses policy tiers', () => {
  const result = computeRefundGuestThbFromCancellation(
    { cancellation_policy: 'moderate' },
    '2026-09-15T14:00:00.000Z',
    1000,
    new Date('2026-09-14T10:00:00.000Z'),
    { paymentCapturedAt: null },
  )
  assert.equal(result.percent, 50)
  assert.equal(result.refundReason, null)
  assert.equal(result.gracePeriodActive, false)
})

test('env defaults for grace knobs', () => {
  assert.equal(getGuestCancelGraceMinutes(), 15)
  assert.equal(getGuestCancelGraceMinHoursBeforeCheckIn(), 24)
})

test('ORDER_RENTER_CANCEL_ELIGIBLE includes paid escrow pipeline', () => {
  const src = readFileSync(join(root, 'lib/booking/status-sets.js'), 'utf8')
  assert.match(src, /BOOKING_SIMPLE_CANCEL_STATUSES/)
  assert.match(src, /BOOKING_LEDGER_REFUND_STATUSES/)
  assert.match(src, /Stage 202\.16/)
})

test('CancelBookingDialog shows grace period banner', () => {
  const src = readFileSync(join(root, 'components/renter/cancel-booking-dialog.jsx'), 'utf8')
  assert.match(src, /gracePeriodActive/)
  assert.match(src, /renterCancel_gracePeriodLine/)
  assert.match(src, /cancel-grace-period-banner/)
})
