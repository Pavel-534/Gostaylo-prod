/**
 * Stage 201.118 — PDP below-the-fold deferred hydration.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-118-pdp-below-fold-lazy.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.118 — PDP below-the-fold lazy', () => {
  it('map already viewport-gates Leaflet (171.23) — do not regress', () => {
    const map = read('components/listing/pdp/ListingMap.jsx')
    assert.match(map, /useElementInView/)
    assert.match(map, /nextDynamic|dynamic/)
    assert.match(map, /ListingMapCore/)
    assert.match(map, /inView/)
  })

  it('reviews defer ReviewsSection until near viewport with CLS fallback', () => {
    const reviews = read('components/listing/pdp/ListingReviews.jsx')
    assert.doesNotMatch(reviews, /from ['"]@\/components\/listing\/ReviewsSection['"]/)
    assert.match(reviews, /PdpDeferredSection/)
    assert.match(reviews, /ReviewsSectionLazy|dynamic\(/)
    assert.match(reviews, /PDP_REVIEWS_FALLBACK_CLASS|pdp-reviews-fallback/)
    assert.match(reviews, /ssr:\s*true/)
  })

  it('details column does not statically import recommendation rails', () => {
    const col = read('components/listing/pdp/ListingPdpDetailsColumn.jsx')
    assert.doesNotMatch(col, /from ['"]@\/components\/recommendations\/SimilarListingsRail['"]/)
    assert.doesNotMatch(col, /from ['"]@\/components\/recommendations\/RecentlyViewedRail['"]/)
    assert.match(col, /PdpDeferredSection/)
    assert.match(col, /dynamic\(/)
    assert.match(col, /ListingHeroHeadline/)
    assert.match(col, /ListingDescription/)
  })

  it('PdpDeferredSection uses ~300px rootMargin by default', () => {
    const defer = read('components/listing/pdp/PdpDeferredSection.jsx')
    assert.match(defer, /300px/)
    assert.match(defer, /useElementInView/)
    assert.match(defer, /useNetworkQuality/)
  })
})
