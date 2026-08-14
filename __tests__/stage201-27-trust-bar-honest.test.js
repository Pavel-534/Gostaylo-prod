/**
 * Stage 201.27 — honest TrustBar (no vanity 1200 / 4.9; global count ≠ city label).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-27-trust-bar-honest.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.27 — honest TrustBar', () => {
  it('hides listings under 10 and rating without reviews', async () => {
    const { resolveTrustBarMetrics, TRUST_BAR_MIN_LISTINGS } = await import(
      '../lib/home/trust-bar-items.js'
    )
    assert.equal(TRUST_BAR_MIN_LISTINGS, 10)

    assert.deepEqual(resolveTrustBarMetrics(null), { listingsCount: null, avgRating: null })
    assert.deepEqual(resolveTrustBarMetrics({ listingsCount: 9, avgRating: 0 }), {
      listingsCount: null,
      avgRating: null,
    })
    assert.deepEqual(resolveTrustBarMetrics({ listingsCount: 10, avgRating: 4.6 }), {
      listingsCount: 10,
      avgRating: 4.6,
    })
    assert.equal(resolveTrustBarMetrics({ listingsCount: 18, avgRating: null }).avgRating, null)
  })

  it('drops vanity fallbacks in UI and public stats API', () => {
    const bar = read('components/home/TrustBar.jsx')
    assert.doesNotMatch(bar, /:\s*1200\b/)
    assert.doesNotMatch(bar, /:\s*4\.9\b/)
    assert.doesNotMatch(bar, /locationContext/)
    assert.doesNotMatch(bar, /trustListingsIn/)
    assert.match(bar, /resolveTrustBarMetrics/)
    assert.match(bar, /trustListingsWorldwide/)
    assert.match(bar, /no vanity fallback/)

    const api = read('app/api/v2/public/stats/route.js')
    assert.doesNotMatch(api, /avgRating \?\? 4\.9/)
    assert.match(api, /avgRating,/)

    const home = read('components/PlatformHomeContent.jsx')
    assert.doesNotMatch(home, /locationContext=\{where/)
  })
})
