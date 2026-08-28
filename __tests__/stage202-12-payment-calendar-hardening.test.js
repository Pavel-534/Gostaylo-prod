/**
 * Stage 202.12 — YooKassa deterministic idempotence + checkout escrow gate + max stay.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  deterministicUuidV4FromSeed,
  resolveIdempotenceKey,
} from '../lib/payments/yookassa.js'
import {
  isCheckoutBookingPaymentCapturedPendingEscrow,
  isCheckoutBookingPaymentSettled,
  isCheckoutIntentPaymentPaid,
} from '../app/(storefront)/checkout/[bookingId]/hooks/checkout-payment-intent-status.js'

const root = process.cwd()
const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

test('deterministicUuidV4FromSeed is stable UUID v4', () => {
  const a = deterministicUuidV4FromSeed('yookassa-idempotence:pi-abc')
  const b = deterministicUuidV4FromSeed('yookassa-idempotence:pi-abc')
  const c = deterministicUuidV4FromSeed('yookassa-idempotence:pi-xyz')
  assert.match(a, uuidV4)
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test('resolveIdempotenceKey uses deterministic key per intent id (no random race)', () => {
  const k1 = resolveIdempotenceKey({ id: 'pi-test-1', metadata: {} })
  const k2 = resolveIdempotenceKey({ id: 'pi-test-1', metadata: {} })
  assert.equal(k1.generated, true)
  assert.equal(k1.key, k2.key)
  assert.match(k1.key, uuidV4)
})

test('resolveIdempotenceKey prefers persisted metadata UUID', () => {
  const key = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
  const r = resolveIdempotenceKey({
    id: 'pi-other',
    metadata: { yookassa_idempotence_key: key },
  })
  assert.equal(r.generated, false)
  assert.equal(r.key, key)
})

test('checkout success helpers: settled vs intent PAID', () => {
  assert.equal(isCheckoutBookingPaymentSettled('PAID_ESCROW'), true)
  assert.equal(isCheckoutBookingPaymentSettled('COMPLETED'), true)
  assert.equal(isCheckoutBookingPaymentSettled('PAID'), false)
  assert.equal(isCheckoutBookingPaymentCapturedPendingEscrow('PAID'), true)
  assert.equal(isCheckoutIntentPaymentPaid('PAID'), true)
})

test('payment return poll does not finishSuccess on intent PAID alone', () => {
  const src = readFileSync(
    join(root, 'app/(storefront)/checkout/[bookingId]/hooks/useCheckoutPaymentReturn.js'),
    'utf8',
  )
  assert.match(src, /isCheckoutBookingPaymentSettled/)
  assert.match(src, /Stage 202\.12/)
  assert.doesNotMatch(
    src,
    /if \(isCheckoutIntentPaymentPaid\(intentStatus\)\) \{\s*finishSuccess\(\)/,
  )
})

test('mir-ru fails closed when idempotence persist fails', () => {
  const src = readFileSync(join(root, 'lib/services/payment-adapters/mir-ru.adapter.js'), 'utf8')
  assert.match(src, /YOOKASSA_IDEMPOTENCE_PERSIST_FAILED/)
  assert.match(src, /persistIdempotenceKey/)
})

test('initiate reuses INITIATED session', () => {
  const src = readFileSync(join(root, 'lib/services/payment-intent.service.js'), 'utf8')
  assert.match(src, /tryReuseInitiatedSession/)
  assert.match(src, /reusedExistingSession/)
  assert.match(src, /checkout_url/)
})

test('bookings API enforces MAX_STAY_VIOLATION', () => {
  const src = readFileSync(join(root, 'app/api/v2/bookings/route.js'), 'utf8')
  assert.match(src, /MAX_STAY_VIOLATION/)
  assert.match(src, /max_booking_days/)
})

test('PlatformCalendar enforces minStay nights', () => {
  const src = readFileSync(join(root, 'components/platform-calendar.jsx'), 'utf8')
  assert.match(src, /minStay = 1/)
  assert.match(src, /nights < minNights/)
})
