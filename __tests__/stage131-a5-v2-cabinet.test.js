/**
 * Stage 131.A5 — v2 cabinet hero + inline calculator.
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a5-v2-cabinet.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('Stage 131.A5 — v2 cabinet', () => {
  it('TabEarnings refactored: no status/balance/extra calculators', () => {
    const src = read('components/referral/ReferralProfileTabEarnings.jsx')
    assert.doesNotMatch(src, /ReferralYourStatusCard/)
    assert.doesNotMatch(src, /ReferralBalanceBreakdown/)
    assert.doesNotMatch(src, /ReferralEarningsEstimator/)
    assert.doesNotMatch(src, /ReferralAmbassadorLevels/)
    assert.doesNotMatch(src, /ReferralBadgesGrid/)
  })

  it('ReferralProfilePage: hero exists + tabs order is Earnings → Team → Link → History → Settings', () => {
    const src = read('components/referral/ReferralProfilePage.jsx')
    assert.match(src, /stage131a5_heroWelcomeTitle/)
    assert.match(src, /ReferralCalculatorV2/)
    assert.match(src, /directPartnersInvited/)
    assert.match(src, /handleHeroShare/)
    assert.match(src, /navigator\.share/)
    assert.match(src, /stage131a5_heroShareCta/)

    assert.match(
      src,
      /TabsTrigger value="earnings"[\s\S]*TabsTrigger value="team"[\s\S]*TabsTrigger value="link"[\s\S]*TabsTrigger value="history"[\s\S]*TabsTrigger value="settings"/,
    )
  })

  it('Activity feed: supports limit + hides load more + carousel mode', () => {
    const src = read('components/referral/ReferralActivityFeed.jsx')
    assert.match(src, /pageLimit = DEFAULT_PAGE_LIMIT/)
    assert.match(src, /hideLoadMore/)
    assert.match(src, /layout === 'carousel'/)
    assert.match(src, /limit: String\(pageLimit\)/)
  })

  it('Calculator endpoint: passes L1 count and L2 conversion from query (incl. activity alias)', () => {
    const src = read('app/api/v2/referral/calculator/route.js')
    assert.match(src, /l1BookingsCount/)
    assert.match(src, /l2ConversionRate/)
    assert.match(src, /l1ActivityRate/)
    assert.match(src, /computePublicReferralCalculatorEstimate/)
  })

  it('Calculator service: exposes totals for UI breakdown', () => {
    const src = read('lib/services/marketing/referral-public-calculator.service.js')
    assert.match(src, /l2ConversionRate/)
    assert.match(src, /l1TotalThb/)
    assert.match(src, /l2TotalThb/)
    assert.match(src, /l3TotalThb/)
    assert.match(src, /guestCashbackTotalThb/)
  })
})
