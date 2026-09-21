/**
 * Catalog price filter labels follow header UI currency (not hardcoded ฿).
 * Values remain THB in URL/API (minPriceThb / max_price).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-46-search-filters-currency-display.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.46 — search filters price currency display', () => {
  it('SearchFiltersPanel uses storefront FX SSOT for labels and slider amounts', () => {
    const src = read('components/search/SearchFiltersPanel.jsx')
    assert.match(src, /useStorefrontDisplayFx/)
    assert.match(src, /getCurrencySymbol/)
    assert.match(src, /formatGuestThbAsDisplay/)
    assert.doesNotMatch(src, /Цена за ночь \(฿\)/)
    assert.doesNotMatch(src, /`฿\$\{slide/)
    assert.match(src, /minPriceThb/)
    assert.match(src, /LISTINGS_PRICE_SLIDER_MAX_THB/)
  })
})
