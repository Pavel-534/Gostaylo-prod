/**
 * Stage 202.7 — YooKassa pending reconcile helpers + metadata user_id.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-7-yookassa-pending-reconcile.test.js
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 202.7 YooKassa battle readiness (no two-stage)', () => {
  it('createPayment stays capture:true; buildMetadata accepts user_id', async () => {
    const src = read('lib/payments/yookassa.js')
    assert.match(src, /capture:\s*true/)
    assert.doesNotMatch(src, /capture:\s*false/)
    assert.match(src, /user_id/)
    assert.match(src, /userId/)

    const { buildMetadata } = await import('@/lib/payments/yookassa.js')
    const withUser = buildMetadata({
      bookingId: 'b1',
      paymentIntentId: 'pi-1',
      amountThb: 100,
      userId: 'guest-42',
    })
    assert.equal(withUser.user_id, 'guest-42')
    assert.equal(withUser.userId, 'guest-42')
    assert.equal(withUser.booking_id, 'b1')

    const without = buildMetadata({
      bookingId: 'b1',
      paymentIntentId: 'pi-1',
      amountThb: 100,
    })
    assert.equal(without.user_id, undefined)
  })

  it('mir-ru adapter forwards booking renter_id as userId', () => {
    const src = read('lib/services/payment-adapters/mir-ru.adapter.js')
    assert.match(src, /renter_id/)
    assert.match(src, /userId/)
    assert.match(src, /createPayment\(/)
  })

  it('resolveYookassaPaymentIdFromIntent skips mocks and URLs', async () => {
    const {
      resolveYookassaPaymentIdFromIntent,
      isIntentAgeEligibleForYookassaPoll,
      YOOKASSA_PENDING_MIN_AGE_MS,
    } = await import('@/lib/payment/yookassa-pending-reconcile-helpers.js')

    assert.equal(resolveYookassaPaymentIdFromIntent('mock-mir-pi-1', {}), null)
    assert.equal(
      resolveYookassaPaymentIdFromIntent('https://yoomoney.ru/checkout/x', {}),
      null,
    )
    assert.equal(
      resolveYookassaPaymentIdFromIntent(null, {
        yookassa_payment_id: '2419a771-000f-5000-9000-1edaf29243f2',
      }),
      '2419a771-000f-5000-9000-1edaf29243f2',
    )

    const now = Date.now()
    assert.equal(
      isIntentAgeEligibleForYookassaPoll(new Date(now - 30_000).toISOString(), now),
      false,
    )
    assert.equal(
      isIntentAgeEligibleForYookassaPoll(
        new Date(now - YOOKASSA_PENDING_MIN_AGE_MS - 1000).toISOString(),
        now,
      ),
      true,
    )
  })

  it('cron route + registry + vercel daily fallback exist', () => {
    assert.match(
      read('app/api/cron/reconcile-yookassa-pending/route.js'),
      /reconcileInitiatedYookassaIntents/,
    )
    assert.match(read('lib/cron/cron-registry.js'), /reconcile-yookassa-pending/)
    assert.match(read('vercel.json'), /reconcile-yookassa-pending/)
    assert.match(read('lib/ops/stale-cron-monitor.js'), /reconcile-yookassa-pending/)
  })
})
