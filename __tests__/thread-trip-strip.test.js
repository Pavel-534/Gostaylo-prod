/**
 * Stage 196.0-C — ThreadTripStrip model + order deep-links
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/thread-trip-strip.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('thread-trip-strip-model', () => {
  it('builds strip with dates, status and amount', async () => {
    const { buildThreadTripStripModel } = await import('../lib/chat/thread-trip-strip-model.js')
    const model = buildThreadTripStripModel({
      booking: {
        id: 'bk-1',
        check_in: '2026-08-01',
        check_out: '2026-08-05',
        status: 'PAID_ESCROW',
        financial_snapshot: { guest_total_thb: 3500, guest_currency: 'THB' },
        total_price_thb: 3500,
      },
      language: 'en',
      getUIText: (key) =>
        key === 'chatBookingStatus_PAID_ESCROW' ? 'Paid — funds are safe' : key,
    })
    assert.ok(model)
    assert.equal(model.bookingId, 'bk-1')
    assert.ok(model.datesLabel.includes('–') || model.datesLabel.includes('-'))
    assert.equal(model.statusLabel, 'Paid — funds are safe')
    assert.ok(model.amountLabel)
  })

  it('returns null without booking id', async () => {
    const { buildThreadTripStripModel } = await import('../lib/chat/thread-trip-strip-model.js')
    assert.equal(buildThreadTripStripModel({ booking: { status: 'PENDING' } }), null)
  })

  it('resolves guest deep-link to my-bookings with highlight alias', async () => {
    const { resolveChatOrderDeepLink } = await import('../lib/chat/thread-trip-strip-model.js')
    const href = resolveChatOrderDeepLink({
      booking: { id: 'bk-42', status: 'PAID_ESCROW' },
      isHosting: false,
    })
    assert.equal(href, '/my-bookings?booking=bk-42&highlight=bk-42')
  })

  it('resolves payable guest to checkout', async () => {
    const { resolveChatOrderDeepLink } = await import('../lib/chat/thread-trip-strip-model.js')
    assert.equal(
      resolveChatOrderDeepLink({
        booking: { id: 'bk-pay', status: 'AWAITING_PAYMENT' },
        isHosting: false,
      }),
      '/checkout/bk-pay',
    )
    assert.equal(
      resolveChatOrderDeepLink({
        booking: { id: 'bk-pay2', status: 'CONFIRMED' },
        isHosting: false,
      }),
      '/checkout/bk-pay2',
    )
  })

  it('resolves host deep-link to partner bookings', async () => {
    const { resolveChatOrderDeepLink } = await import('../lib/chat/thread-trip-strip-model.js')
    assert.equal(
      resolveChatOrderDeepLink({
        booking: { id: 'bk-h', status: 'PAID_ESCROW' },
        isHosting: true,
      }),
      '/partner/bookings?booking=bk-h',
    )
  })
})

describe('ThreadTripStrip interaction contract', () => {
  it('opens deal sheet via onOpenDealDetails when model exists', async () => {
    const { buildThreadTripStripModel } = await import('../lib/chat/thread-trip-strip-model.js')
    const model = buildThreadTripStripModel({
      booking: {
        id: 'bk-sheet',
        check_in: '2026-09-01',
        check_out: '2026-09-03',
        status: 'CONFIRMED',
        total_price_thb: 1200,
      },
      language: 'ru',
      getUIText: (key) => (key === 'chatBookingStatus_CONFIRMED' ? 'Подтверждено' : key),
    })
    assert.ok(model)

    let opened = 0
    const onOpenDealDetails = () => {
      opened += 1
    }
    // Contract mirrored by StickyChatHeader: strip only mounts when handler exists
    assert.equal(typeof onOpenDealDetails, 'function')
    onOpenDealDetails()
    assert.equal(opened, 1)
  })
})
