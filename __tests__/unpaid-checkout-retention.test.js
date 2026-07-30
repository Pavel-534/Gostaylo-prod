/**
 * Wave H1 — unpaid checkout retention (eligibility + push payload + deep link)
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/unpaid-checkout-retention.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('unpaidCheckoutDeepLink', () => {
  it('points to checkout booking route with sticky pay resume focus', async () => {
    const { unpaidCheckoutDeepLink } = await import(
      '../lib/booking/unpaid-checkout-retention-policy.js'
    )
    assert.equal(
      unpaidCheckoutDeepLink('bk-99'),
      '/checkout/bk-99?resume=1#checkout-sticky-pay',
    )
  })
})

describe('evaluateUnpaidCheckoutNudgeEligibility', () => {
  const base = {
    status: 'AWAITING_PAYMENT',
    metadata: {},
    paymentInitiatedAt: '2026-07-27T10:00:00.000Z',
    expiresAtIso: '2026-07-27T10:30:00.000Z',
    nowMs: Date.parse('2026-07-27T10:12:00.000Z'),
    delayMinutes: 10,
    minRemainingMinutes: 5,
  }

  it('allows nudge after delay with active hold', async () => {
    const { evaluateUnpaidCheckoutNudgeEligibility } = await import(
      '../lib/booking/unpaid-checkout-retention-policy.js'
    )
    const r = evaluateUnpaidCheckoutNudgeEligibility(base)
    assert.equal(r.ok, true)
  })

  it('blocks too early / already sent / expired hold', async () => {
    const { evaluateUnpaidCheckoutNudgeEligibility } = await import(
      '../lib/booking/unpaid-checkout-retention-policy.js'
    )
    assert.equal(
      evaluateUnpaidCheckoutNudgeEligibility({
        ...base,
        nowMs: Date.parse('2026-07-27T10:05:00.000Z'),
      }).reason,
      'too_early',
    )
    assert.equal(
      evaluateUnpaidCheckoutNudgeEligibility({
        ...base,
        metadata: { unpaid_checkout_nudge_sent_at: '2026-07-27T10:11:00.000Z' },
      }).reason,
      'already_sent',
    )
    assert.equal(
      evaluateUnpaidCheckoutNudgeEligibility({
        ...base,
        nowMs: Date.parse('2026-07-27T10:31:00.000Z'),
      }).reason,
      'hold_expired',
    )
  })
})

describe('CHECKOUT_ABANDONED template payload', () => {
  it('renders soft title/body and checkout deep link in data', async () => {
    const { buildRenderedPushNotification, buildPushDataStrings } = await import(
      '../lib/services/push/push-templates.js'
    )
    const { buildUnpaidCheckoutPushData } = await import(
      '../lib/booking/unpaid-checkout-retention-policy.js'
    )

    const data = buildUnpaidCheckoutPushData({
      bookingId: 'bk-7',
      listingTitle: 'Sea View Condo',
    })
    const ru = buildRenderedPushNotification('CHECKOUT_ABANDONED', data, 'ru')
    assert.equal(ru.ok, true)
    assert.equal(ru.title, 'Бронирование ждет подтверждения')
    assert.match(ru.body, /Sea View Condo/)

    const en = buildRenderedPushNotification('CHECKOUT_ABANDONED', data, 'en')
    assert.equal(en.title, 'Your stay is reserved')

    const strings = buildPushDataStrings('CHECKOUT_ABANDONED', data, false)
    assert.match(strings.link, /\/checkout\/bk-7/)
    assert.equal(strings.url, strings.link)
    assert.equal(strings.deepLink, strings.link)
  })
})
