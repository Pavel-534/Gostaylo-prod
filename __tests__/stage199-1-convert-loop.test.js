/**
 * Stage 199.1 — Wave I.2 convert loop (resume checkout + PDP trust copy keys).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage199-1-convert-loop.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('checkout resume focus', () => {
  it('builds resume deep link and detects focus query/hash', async () => {
    const {
      unpaidCheckoutDeepLink,
      shouldFocusCheckoutStickyPay,
      CHECKOUT_STICKY_PAY_ANCHOR_ID,
    } = await import('../lib/checkout/checkout-resume-focus.js')

    assert.equal(CHECKOUT_STICKY_PAY_ANCHOR_ID, 'checkout-sticky-pay')
    assert.equal(
      unpaidCheckoutDeepLink('abc'),
      `/checkout/abc?resume=1#${CHECKOUT_STICKY_PAY_ANCHOR_ID}`,
    )
    assert.equal(shouldFocusCheckoutStickyPay('resume=1', ''), true)
    assert.equal(shouldFocusCheckoutStickyPay('?focus=pay', ''), true)
    assert.equal(shouldFocusCheckoutStickyPay('', `#${CHECKOUT_STICKY_PAY_ANCHOR_ID}`), true)
    assert.equal(shouldFocusCheckoutStickyPay('', ''), false)
  })
})

describe('PDP booking trust i18n', () => {
  it('exposes escrow / cancel / chat keys for RU and EN', async () => {
    const { listingsPublicUi } = await import('../lib/translations/listings-public.js')
    const { getGuestBookingLabelPlaceholders } = await import(
      '../lib/i18n/guest-booking-labels.js'
    )

    for (const lang of ['ru', 'en']) {
      const slice = listingsPublicUi[lang]
      assert.ok(slice.listingBookingTrust_escrow.includes('{brand}'))
      assert.doesNotMatch(slice.listingBookingTrust_escrow, /Escrow/i)
      assert.ok(String(slice.listingBookingTrust_cancel).length > 8)
      assert.ok(slice.listingBookingTrust_chat.includes('{provider}'))
      const ph = getGuestBookingLabelPlaceholders({
        categorySlug: 'apartments',
        language: lang,
      })
      const chat = slice.listingBookingTrust_chat.replace(/\{provider\}/g, ph.provider)
      assert.doesNotMatch(chat, /\{provider\}/)
      assert.ok(ph.provider.length > 0)
    }
  })
})

describe('mobile search density SSOT', () => {
  it('caps catalog media height so the next card can peek', async () => {
    const layout = await import('../lib/listing/listing-card-layout.js')
    assert.match(layout.LISTING_CARD_ROOT_MAX_H, /80dvh/)
    assert.match(layout.LISTING_CARD_MEDIA_ASPECT, /48dvh|max-h-/)
    assert.match(layout.LISTING_CATALOG_GRID_CLASSES, /gap-3/)
  })
})
