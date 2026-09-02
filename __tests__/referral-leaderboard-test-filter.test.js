/**
 * Referral leaderboard — exclude smoke/E2E referrers from public aggregates.
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/referral-leaderboard-test-filter.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('referral leaderboard test-referrer filter', () => {
  it('referral-leaderboard-db excludes isTestProfileId referrers by default', () => {
    const src = read('lib/referral/referral-leaderboard-db.js')
    assert.match(src, /isTestProfileId/)
    assert.match(src, /excludeTestReferrers/)
    assert.match(src, /finalizeLeaderboardRows/)
    assert.match(src, /leaderboardFetchLimit/)
  })

  it('AUDIT_02 partner id is a test profile (user-smoke-a02-p)', () => {
    const { isTestProfileId } = require('../lib/e2e/test-marketing-referral-markers.js')
    assert.equal(isTestProfileId('user-smoke-a02-p'), true)
  })

  it('A02Partner masks to A0...er in cabinet leaderboard privacy', () => {
    const { maskReferralLeaderboardName } = require('../lib/referral/leaderboard-privacy.js')
    assert.equal(maskReferralLeaderboardName('user-smoke-a02-p', 'A02Partner', null), 'A0...er')
  })
})
