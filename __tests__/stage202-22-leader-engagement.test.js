/**
 * Stage 202.22 — engagement UX wiring contract.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-22-leader-engagement.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

describe('Stage 202.22 — leader engagement UX', () => {
  it('single engagement API + shared metrics loader', () => {
    assert.match(read('app/api/v2/referral/me/engagement/route.js'), /getSessionPayload/)
    assert.match(read('app/api/v2/referral/me/engagement/route.js'), /buildReferralEngagementPayload/)
    assert.match(read('lib/services/marketing/local-leader-metrics.service.js'), /computeQuestsProgress/)
    assert.doesNotMatch(read('app/api/v2/referral/me/engagement/route.js'), /fintech-waterfall/)
  })

  it('ReferralProfilePage mounts engagement section (not partner dashboard)', () => {
    const src = read('components/referral/ReferralProfilePage.jsx')
    assert.match(src, /ReferralLeaderEngagementSection/)
    assert.doesNotMatch(read('app/(storefront)/profile/referral/page.js'), /ReferralLeaderEngagementSection/)
  })

  it('UI disambiguates community path from withdraw tiers', () => {
    assert.match(read('components/referral/LocalLeaderTier.jsx'), /localLeaderTier_subtitle/)
    assert.match(read('lib/translations/slices/local-leader-tier.js'), /L1\/L2\/L3/)
    assert.doesNotMatch(read('components/referral/LocalLeaderTier.jsx'), /\.module\.css/)
  })

  it('quests use display currency formatter, not hardcoded THB label', () => {
    assert.match(read('components/referral/QuestsBlock.jsx'), /ReferralLedgerAmount/)
    assert.doesNotMatch(read('components/referral/QuestsBlock.jsx'), /\+\{q\.rewardThb\} THB/)
  })

  it('qualified host SSOT lives in qualified-host-metrics (not fraud-gate)', () => {
    assert.match(read('lib/referral/qualified-host-metrics.js'), /host_activation/)
    assert.match(read('lib/config/leader-tier-thresholds.js'), /qualified-host-metrics/)
  })
})
