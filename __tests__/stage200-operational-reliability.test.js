/**
 * Stage 200 — Wave J.1 Operational reliability (unit smoke).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-operational-reliability.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200 — cron registry (Hobby + cron-job.org)', () => {
  it('lists critical money jobs and does not require hourly vercel entries', async () => {
    const {
      CRON_REGISTRY,
      listCriticalCronJobs,
      listExternalRequiredCronJobs,
    } = await import('../lib/cron/cron-registry.js')

    assert.ok(CRON_REGISTRY.length >= 20)
    const critical = listCriticalCronJobs()
    const names = critical.map((j) => j.jobName)
    assert.ok(names.includes('escrow-thaw'))
    assert.ok(names.includes('promote-ready-for-payout'))
    assert.ok(names.includes('payout-batch-pools'))

    const promote = CRON_REGISTRY.find((j) => j.jobName === 'promote-ready-for-payout')
    assert.equal(promote.vercelJson, false)
    assert.equal(promote.scheduler, 'external_hourly')

    const vercel = JSON.parse(read('vercel.json'))
    const vercelPaths = new Set((vercel.crons || []).map((c) => c.path))
    assert.ok(vercelPaths.has('/api/cron/escrow-thaw'))
    assert.equal(vercelPaths.has('/api/cron/promote-ready-for-payout'), false)

    const external = listExternalRequiredCronJobs()
    assert.ok(external.some((j) => j.jobName === 'promote-ready-for-payout'))
  })

  it('every registered cron route exists and uses assertCronAuthorized', () => {
    const { CRON_REGISTRY } = require('../lib/cron/cron-registry.js')
    for (const entry of CRON_REGISTRY) {
      const rel = path.join(
        'app/api/cron',
        entry.jobName,
        'route.js',
      )
      // path uses jobName which matches folder for our registry
      const folder = entry.path.replace('/api/cron/', '')
      const src = read(`app/api/cron/${folder}/route.js`)
      assert.match(src, /assertCronAuthorized/, `${rel} missing CRON_SECRET guard`)
    }
  })
})

describe('Stage 200 — toUnifiedOrder vertical types', () => {
  it('keeps tour and service distinct from home/transport', async () => {
    const { toUnifiedOrder, mapServiceTypeToOrderUiType } = await import(
      '../lib/models/unified-order.js'
    )

    assert.equal(mapServiceTypeToOrderUiType('stay'), 'home')
    assert.equal(mapServiceTypeToOrderUiType('transport'), 'transport')
    assert.equal(mapServiceTypeToOrderUiType('tour'), 'activity')
    assert.equal(mapServiceTypeToOrderUiType('service'), 'service')

    const tour = toUnifiedOrder({
      id: 'b1',
      status: 'PAID_ESCROW',
      price_thb: 1000,
      listings: { category_slug: 'tours-phuket', wizard_profile: 'tour' },
    })
    assert.equal(tour.type, 'activity')
    assert.equal(tour.serviceType, 'tour')

    const service = toUnifiedOrder({
      id: 'b2',
      status: 'CONFIRMED',
      price_thb: 500,
      listings: { category_slug: 'massage', wizard_profile: 'service' },
    })
    assert.equal(service.type, 'service')
    assert.equal(service.serviceType, 'service')

    const stay = toUnifiedOrder({
      id: 'b3',
      status: 'INQUIRY',
      price_thb: 2000,
      listings: { category_slug: 'villa', wizard_profile: 'housing' },
    })
    assert.equal(stay.type, 'home')
    assert.equal(stay.serviceType, 'stay')
  })
})

describe('Stage 200 — payment webhook idempotency contract', () => {
  it('marks escrow pipeline statuses as idempotent short-circuit', async () => {
    const { isPaymentAcquiringWebhookIdempotentBookingStatus } = await import(
      '../lib/booking/status-sets.js'
    )
    for (const st of [
      'PAID_ESCROW',
      'CHECKED_IN',
      'THAWED',
      'READY_FOR_PAYOUT',
      'COMPLETED',
    ]) {
      assert.equal(
        isPaymentAcquiringWebhookIdempotentBookingStatus(st),
        true,
        `${st} must be idempotent`,
      )
    }
    assert.equal(isPaymentAcquiringWebhookIdempotentBookingStatus('AWAITING_PAYMENT'), false)
    assert.equal(isPaymentAcquiringWebhookIdempotentBookingStatus('CONFIRMED'), false)
    assert.equal(isPaymentAcquiringWebhookIdempotentBookingStatus('PAID'), false)
  })

  it('webhook route uses structured failure logging and try/catch', () => {
    const src = read('app/api/webhooks/payments/confirm/route.js')
    assert.match(src, /logPaymentWebhookFailure/)
    assert.match(src, /payment_webhook_idempotent/)
    assert.match(src, /handlePaymentConfirmWebhook/)
    assert.match(src, /unhandled_exception/)
    assert.match(src, /isPaymentAcquiringWebhookIdempotentBookingStatus/)
  })
})
