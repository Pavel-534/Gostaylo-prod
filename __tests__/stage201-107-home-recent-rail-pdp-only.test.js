/**
 * Stage 201.107 — Recently viewed stays on PDP; home keeps For You only.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-107-home-recent-rail-pdp-only.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  RECENTLY_VIEWED_MIN_PDP,
} from '../lib/recommendations/constants.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.107 — recently viewed is PDP-only', () => {
  it('home mounts For You and does not mount recently viewed', () => {
    const home = read('components/PlatformHomeContent.jsx')
    assert.match(home, /ForYouRail/)
    assert.doesNotMatch(home, /RecentlyViewedRail/)
    assert.doesNotMatch(home, /recent_home/)
    assert.doesNotMatch(home, /RECENTLY_VIEWED_MIN_HOME/)
  })

  it('PDP still mounts recently viewed after similar', () => {
    const pdp = read('components/listing/pdp/ListingPdpDetailsColumn.jsx')
    assert.match(pdp, /SimilarListingsRail/)
    assert.match(pdp, /RecentlyViewedRail/)
    assert.equal(RECENTLY_VIEWED_MIN_PDP, 1)
  })

  it('analytics no longer accepts retired recent_home surface', () => {
    const analytics = read('lib/analytics/recommendation-rail-analytics.js')
    assert.match(analytics, /'recent_pdp'/)
    assert.doesNotMatch(analytics, /'recent_home'/)
    const constants = read('lib/recommendations/constants.js')
    assert.doesNotMatch(constants, /RECENTLY_VIEWED_MIN_HOME/)
  })
})
