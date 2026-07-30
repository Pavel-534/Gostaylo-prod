/**
 * Stage 199.3 — Wave I.4 One Surface / Golden Loop integrity smoke (unit).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage199-3-one-surface.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

describe('isUnresolvedI18nKey / isTechnicalErrorCode', () => {
  it('flags raw keys and SCREAMING_SNAKE codes', async () => {
    const {
      isUnresolvedI18nKey,
      isTechnicalErrorCode,
      resolveFriendlyUiText,
    } = await import('../lib/i18n/is-unresolved-i18n-key.js')

    assert.equal(isUnresolvedI18nKey('checkout_failedTitle', 'checkout_failedTitle'), true)
    assert.equal(isUnresolvedI18nKey('Payment failed', 'checkout_failedTitle'), false)
    assert.equal(isTechnicalErrorCode('WALLET_ACTIVATION_REQUIRED'), true)
    assert.equal(isTechnicalErrorCode('Card declined'), false)

    const getUIText = (key) => (key === 'ok_key' ? 'OK' : key)
    assert.equal(resolveFriendlyUiText('ok_key', 'en', getUIText, 'fallback'), 'OK')
    assert.equal(
      resolveFriendlyUiText('missing_key', 'en', getUIText, 'Friendly fallback'),
      'Friendly fallback',
    )
  })
})

describe('Golden Loop surface contracts', () => {
  it('exports StorefrontStateView and EmptyState testids', async () => {
    const emptySrc = fs.readFileSync(
      path.join(process.cwd(), 'components/empty-state.jsx'),
      'utf8',
    )
    assert.match(emptySrc, /data-testid="empty-state"/)
    assert.match(emptySrc, /min-h-\[44px\]/)

    const shellSrc = fs.readFileSync(
      path.join(process.cwd(), 'components/product/StorefrontStateView.jsx'),
      'utf8',
    )
    assert.match(shellSrc, /data-testid=\{testId\}/)
    assert.match(shellSrc, /min-h-\[44px\]/)

    const buttonSrc = fs.readFileSync(
      path.join(process.cwd(), 'components/ui/button.jsx'),
      'utf8',
    )
    assert.match(buttonSrc, /min-h-\[44px\]/)
  })

  it('wires catalog / PDP / checkout / my-bookings state surfaces', () => {
    const checks = [
      ['components/search/ListingSidebar.jsx', 'catalog-load-error'],
      ['app/(storefront)/listings/error.jsx', 'listings-segment-error'],
      ['app/(storefront)/listings/[id]/ListingPdpGateViews.jsx', 'listing-pdp-not-found'],
      [
        'app/(storefront)/checkout/[bookingId]/components/CheckoutStateViews.jsx',
        'checkout-loading',
      ],
      ['app/(storefront)/my-bookings/page.js', 'my-bookings-load-error'],
    ]
    for (const [rel, needle] of checks) {
      const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
      assert.match(src, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    }
  })

  it('uses dedicated my-bookings load error copy (not failedToLoad/transactions)', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/(storefront)/my-bookings/page.js'),
      'utf8',
    )
    assert.match(src, /myBookings_loadErrorBody/)
    assert.match(src, /myBookings_retry/)
    assert.doesNotMatch(src, /failedToLoad/)
  })

  it('catalog soft-fallback and segment error use i18n keys', () => {
    const sidebar = fs.readFileSync(
      path.join(process.cwd(), 'components/search/ListingSidebar.jsx'),
      'utf8',
    )
    assert.match(sidebar, /catalogSoftFallback_title/)
    assert.match(sidebar, /catalogLoadError_body/)
    const err = fs.readFileSync(
      path.join(process.cwd(), 'app/(storefront)/listings/error.jsx'),
      'utf8',
    )
    assert.match(err, /listingsSegmentError_body/)
  })
})
