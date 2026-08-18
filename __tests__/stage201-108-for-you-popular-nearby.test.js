/**
 * Stage 201.108 — Popular nearby rail: rating, featured dedupe, cold-guest min 2.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-108-for-you-popular-nearby.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  listingIdsForRailDedupe,
  resolveForYouRailDisplay,
} from '../lib/recommendations/for-you-rail-display.js'
import { resolveRecommendationRailRating } from '../lib/recommendations/recommendation-rail-rating.js'
import {
  FOR_YOU_MIN_RESULTS,
  PERSONALIZATION_MIN_RESULTS,
} from '../lib/recommendations/constants.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.108 — popular nearby rail', () => {
  it('shows rating when score exists and hides when it does not', () => {
    assert.deepEqual(resolveRecommendationRailRating({ rating: 4.6, reviewsCount: 12 }), {
      rating: 4.6,
      reviewsCount: 12,
      show: true,
    })
    assert.equal(resolveRecommendationRailRating({ avg_rating: 0 }).show, false)
    const card = read('components/recommendations/RecommendationRailCard.jsx')
    assert.match(card, /resolveRecommendationRailRating/)
    assert.match(card, /fill-amber-400/)
  })

  it('drops featured/top ids and still renders a 2-card cold rail', () => {
    assert.equal(FOR_YOU_MIN_RESULTS, 2)
    assert.equal(PERSONALIZATION_MIN_RESULTS, 6)
    const listings = [
      { id: 'top-1' },
      { id: 'rail-1' },
      { id: 'rail-2' },
      { id: 'top-2' },
    ]
    const featured = listingIdsForRailDedupe([{ id: 'top-1' }, { id: 'top-2' }])
    const shown = resolveForYouRailDisplay(listings, {
      minResults: FOR_YOU_MIN_RESULTS,
      isMobile: false,
      isCatalogXsHidden: false,
      mobileMaxCards: 5,
      excludeListingIds: featured,
    })
    assert.deepEqual(
      shown.visible.map((row) => row.id),
      ['rail-1', 'rail-2'],
    )
    assert.equal(shown.shouldRender, true)

    const tooFew = resolveForYouRailDisplay([{ id: 'top-1' }], {
      minResults: FOR_YOU_MIN_RESULTS,
      isMobile: false,
      isCatalogXsHidden: false,
      mobileMaxCards: 5,
      excludeListingIds: featured,
    })
    assert.equal(tooFew.shouldRender, false)
  })

  it('home excludes featured ids; copy is Popular nearby', () => {
    const home = read('components/PlatformHomeContent.jsx')
    assert.match(home, /excludeListingIds=\{featuredListingIds\}/)
    const ru = read('lib/translations/listings-public.js')
    assert.match(ru, /forYouTitle: "Популярно рядом"/)
    assert.match(ru, /forYouTitle: "Popular nearby"/)
    assert.doesNotMatch(ru, /forYouTitle: "Для вас"/)
  })
})
