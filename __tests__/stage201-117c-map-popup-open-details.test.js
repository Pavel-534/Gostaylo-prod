/**
 * Stage 201.117c — catalog map «Подробнее» must navigate to PDP.
 * Regression: polygon draw import replaced listing-hero-transition import.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-117c-map-popup-open-details.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.117c — map popup open details', () => {
  it('catalog client imports listing-hero-transition helpers used by map open', () => {
    const src = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.match(src, /from ['"]@\/lib\/navigation\/listing-hero-transition['"]/)
    assert.match(src, /navigateWithListingHeroTransition/)
    assert.match(src, /prefetchListingPdp/)
    assert.match(src, /handleMapListingOpen/)
    assert.match(src, /router\.push\(`\/listings\/\$\{listingId\}`\)/)
  })

  it('popup CTA uses onOpenDetails or local navigate helper', () => {
    const card = read('components/listing/ListingPopupCard.jsx')
    assert.match(card, /onOpenDetails\(listingId\)/)
    assert.match(card, /navigateWithListingHeroTransition/)
    assert.match(card, /data-testid="map-listing-popup-open"/)
  })
})
