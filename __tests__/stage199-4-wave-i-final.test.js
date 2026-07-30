/**
 * Stage 199.4 — Wave I.4 Final Polish / Golden Loop empty·error smoke (unit).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage199-4-wave-i-final.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 199.4 — failedToLoad split', () => {
  it('keeps generic failedToLoad and finances-specific transactions key', () => {
    const errors = read('lib/translations/errors.js')
    assert.match(errors, /failedToLoad:\s*"Failed to load"/)
    assert.match(errors, /failedToLoadTransactions:\s*"Failed to load transactions"/)
    assert.match(errors, /failedToLoad:\s*"加载失败"/)
    assert.match(errors, /failedToLoadTransactions:\s*"加载交易失败"/)
    assert.doesNotMatch(errors, /failedToLoad:\s*"Failed to load transactions"/)

    const finances = read('components/partner/finances/PartnerFinancesTransactionHistory.jsx')
    assert.match(finances, /failedToLoadTransactions/)
    assert.doesNotMatch(finances, /t\('failedToLoad'\)/)
  })
})

describe('Stage 199.4 — Checkout One Surface', () => {
  it('wires success and unavailable through StorefrontStateView', () => {
    const src = read('app/(storefront)/checkout/[bookingId]/components/CheckoutStateViews.jsx')
    assert.match(src, /StorefrontStateView/)
    assert.match(src, /testId="checkout-success"/)
    assert.match(src, /testId="checkout-unavailable"/)
    assert.match(src, /variant="success"/)
    assert.match(src, /variant="denied"/)

    const shell = read('components/product/StorefrontStateView.jsx')
    assert.match(shell, /success:\s*CheckCircle2/)
    assert.match(shell, /tertiaryLabel/)
  })
})

describe('Stage 199.4 — Golden Loop empty/error surface smoke', () => {
  it('retains empty/error testids on catalog, PDP, listings error, my-bookings, favorites', () => {
    const checks = [
      ['components/search/ListingSidebar.jsx', 'catalog-load-error'],
      ['app/(storefront)/listings/error.jsx', 'listings-segment-error'],
      ['app/(storefront)/listings/[id]/ListingPdpGateViews.jsx', 'listing-pdp-not-found'],
      ['app/(storefront)/my-bookings/page.js', 'my-bookings-load-error'],
      ['app/(storefront)/checkout/[bookingId]/components/CheckoutStateViews.jsx', 'checkout-success'],
      ['app/(storefront)/checkout/[bookingId]/components/CheckoutStateViews.jsx', 'checkout-unavailable'],
      ['app/(storefront)/renter/favorites/page.js', 'renter-favorites-load-error'],
    ]
    for (const [rel, needle] of checks) {
      assert.match(read(rel), new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    }
  })

  it('renter area avoids language === ru ternaries for user-facing copy', () => {
    for (const rel of [
      'app/(storefront)/renter/favorites/page.js',
      'app/(storefront)/renter/dashboard/page.js',
      'app/(storefront)/renter/layout.js',
    ]) {
      const src = read(rel)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
      assert.doesNotMatch(src, /language\s*===\s*['"]ru['"]/)
    }
  })

  it('compact filter controls use mobile min-h 44px', () => {
    const src = read('components/search/UnifiedSearchBar.jsx')
    assert.match(src, /SelectTrigger className="min-h-\[44px\]/)
    assert.match(src, /triggerClassName="min-h-\[44px\]/)
    assert.match(src, /TimeSelect[^>]+min-h-\[44px\]/)
  })
})
