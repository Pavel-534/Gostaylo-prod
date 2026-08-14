/**
 * Catalog mobile sort sheet + map short label; sort still hits URL + applyCatalogSort.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/catalog-mobile-sort-sheet.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const { applyCatalogSort } = require('../lib/recommendations/ranking-policy.js')
const { listCatalogSortValues } = require('../lib/search/catalog-sort-ui.js')

function listing(id, priceThb) {
  return { id, base_price_thb: priceThb, guest_display_price_thb: priceThb }
}

describe('catalog mobile sort sheet', () => {
  it('applyCatalogSort orders by price_asc and price_desc', () => {
    const rows = [listing('b', 300), listing('a', 100), listing('c', 200)]
    assert.deepEqual(
      applyCatalogSort(rows, 'price_asc').map((r) => r.id),
      ['a', 'c', 'b'],
    )
    assert.deepEqual(
      applyCatalogSort(rows, 'price_desc').map((r) => r.id),
      ['b', 'c', 'a'],
    )
  })

  it('listCatalogSortValues hides distance when unavailable', () => {
    assert.deepEqual(listCatalogSortValues({ distanceDisabled: true }), [
      'recommended',
      'price_asc',
      'price_desc',
    ])
  })

  it('catalog client commits sort to URL', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'app/(storefront)/listings/listings-catalog-client.jsx'),
      'utf8',
    )
    assert.match(src, /commitToUrl\(\{ catalogSort: next/)
  })

  it('narrow catalog uses sort sheet + short map label', () => {
    const sort = fs.readFileSync(
      path.join(process.cwd(), 'components/search/CatalogSortSelect.jsx'),
      'utf8',
    )
    const sidebar = fs.readFileSync(
      path.join(process.cwd(), 'components/search/ListingSidebar.jsx'),
      'utf8',
    )
    assert.match(sort, /ArrowUpDown/)
    assert.match(sort, /catalog-sort-sheet/)
    assert.match(sort, /SheetContent/)
    assert.match(sidebar, /showMapShort/)
  })
})
