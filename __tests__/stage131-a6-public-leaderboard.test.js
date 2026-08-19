/**
 * Stage 131.A6 — public leaderboard (anonymous, masked names, month + alltime).
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a6-public-leaderboard.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('Stage 131.A6 — public leaderboard', () => {
  it('SQL: provides all-time RPC without earned_at bounds', () => {
    const sql = read('migrations/stage131_a6_referral_leaderboard_alltime.sql')
    assert.match(sql, /referral_ledger_leaderboard_alltime\s*\(/)
    assert.match(sql, /WHERE\s+rl\.status\s*=\s*'earned'/)
    assert.doesNotMatch(sql, /earned_at\s*>=|earned_at\s*</i)
  })

  it('Masking: uses first_name + last initial + dot, fallback to "Амбассадор #"', () => {
    const src = read('lib/referral/public-leaderboard-privacy.js')
    assert.match(src, /first_name/)
    assert.match(src, /last_name/)
    assert.match(src, /last\[0\]/)
    assert.match(src, /Амбассадор\s*#\$\{shortId\}/)
  })

  it('Public endpoint: uses rateLimitCheck (60/min) + optional self-exclusion', () => {
    const route = read('app/api/v2/referral/leaderboard/public/route.js')
    assert.match(route, /rateLimitCheck\(request,\s*'referral_leaderboard_public'\)/)
    assert.match(route, /const\s+excludeUserId\s*=\s*session\?\.userId/)
    assert.match(route, /internal\.filter\(\(x\)\s*=>\s*String\(x\.referrerId\)\s*!==\s*excludeUserId\)/)
  })

  it('Public endpoint: caching is enabled with 5-minute TTL (unstable_cache revalidate=300)', () => {
    const route = read('app/api/v2/referral/leaderboard/public/route.js')
    assert.match(route, /unstable_cache/)
    assert.match(route, /CACHE_REVALIDATE_SEC\s*=\s*300/)
    assert.match(route, /{[^}]*revalidate:\s*CACHE_REVALIDATE_SEC[^}]*}/)
  })

  it('Public endpoint: bucketing labels follow TZ ranges', () => {
    const route = read('app/api/v2/referral/leaderboard/public/route.js')
    for (const label of ['< 1K', '1K-5K', '5K-10K', '10K-25K', '25K-50K', '50K-100K', '100K+']) {
      assert.match(route, new RegExp(label.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')))
    }
  })

  it('Public endpoint: returns correct contract fields + next_rank_hint', () => {
    const route = read('app/api/v2/referral/leaderboard/public/route.js')
    assert.match(route, /next_rank_hint/)
    assert.match(route, /entries/)
    assert.match(route, /masked_name/)
    assert.match(route, /earned_bucket_thb/)
    assert.match(route, /direct_partners_count/)
    assert.match(route, /badge_count/)
    assert.match(route, /tier_name/)
    assert.match(route, /as_of/)
  })

  it('UI: renders masked names, ranks and tooltip with active partners + badge count', () => {
    const src = read('components/referral/PublicLeaderboard.jsx')
    assert.match(src, /masked_name/)
    assert.match(src, /#\{e\.rank\}/)
    assert.match(src, /Активных партнёров/)
    assert.match(src, /Бейджей/)
    assert.match(src, /earned_bucket_thb/)
    assert.match(src, /direct_partners_count/)
    assert.match(src, /badge_count/)
  })

  it('Page: has CTA to /partner and disclaimer text visible', () => {
    const src = read('app/(marketing)/leaderboard/page.js')
    assert.match(src, /href=\"\/partner\"/)
    assert.match(src, /Доход зависит от активности\. Не гарантирован\./)
    assert.match(src, /Этот месяц/)
    assert.match(src, /За всё время/)
  })

  it('Rate-limit config: bucket exists and max is 60', () => {
    const cfg = read('lib/rate-limit/config.js')
    assert.match(cfg, /referral_leaderboard_public:\s*\{[^}]*max:\s*60/)
  })
})

