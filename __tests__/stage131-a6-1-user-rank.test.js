/**
 * Stage 131.A6.1 — user rank in v2 cabinet hero.
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a6-1-user-rank.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('Stage 131.A6.1 — user rank in cabinet hero', () => {
  it('Endpoint requires auth and returns rank contract', () => {
    const src = read('app/api/v2/referral/me/rank/route.js')
    assert.match(src, /getSessionPayload/)
    assert.match(src, /AUTH_NOT_AUTHENTICATED/)
    assert.match(src, /\brank\b/)
    assert.match(src, /total_ambassadors/)
    assert.match(src, /as_of/)
    assert.match(src, /earned_bucket_thb/)
    assert.match(src, /next_rank_bucket_hint/)
  })

  it('Endpoint returns null rank when user has 0 earned', () => {
    const src = read('lib/referral/compute-user-monthly-rank.js')
    assert.match(src, /if \(myEarned <= 0\)/)
    assert.match(src, /rank: null/)
  })

  it('Endpoint caches with 10-min TTL via unstable_cache', () => {
    const src = read('app/api/v2/referral/me/rank/route.js')
    assert.match(src, /unstable_cache/)
    assert.match(src, /CACHE_TTL_SEC\s*=\s*600/)
    assert.match(src, /revalidate:\s*CACHE_TTL_SEC/)
  })

  it('Endpoint computes next_rank_bucket_hint at bucket level', () => {
    const rankLib = read('lib/referral/compute-user-monthly-rank.js')
    assert.match(rankLib, /bucketLabelFromThb/)
    assert.match(rankLib, /buildNextRankBucketHint/)
    assert.match(read('app/api/v2/referral/me/rank/route.js'), /next_rank_bucket_hint/)
    assert.doesNotMatch(rankLib, /exact|precise|точн/i)
  })

  it('UI shows rank badge only when rank != null AND total >= 5', () => {
    const src = read('components/referral/ReferralProfilePage.jsx')
    assert.match(src, /userRankData\?\.rank != null && Number\(userRankData\.total_ambassadors\) >= 5/)
    assert.match(src, /data-testid="user-rank-badge"/)
  })

  it('UI does NOT show rank badge when 0 earned (rank is null)', () => {
    const src = read('components/referral/ReferralProfilePage.jsx')
    assert.match(src, /userRankData\?\.rank != null/)
  })

  it('i18n key stage131a61_rankLine exists in RU/EN/ZH/TH', () => {
    const src = read('lib/translations/slices/profile-app-referral.js')
    assert.match(src, /stage131a61_rankLine.*Ты на/)
    assert.match(src, /stage131a61_rankLine.*You are/)
    assert.match(src, /stage131a61_rankLine.*你在本月/)
    assert.match(src, /stage131a61_rankLine.*คุณอยู่อันดับ/)
  })
})
