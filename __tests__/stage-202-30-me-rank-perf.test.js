/**
 * Stage 202.30 — me/rank perf (referral_user_rank_for_period RPC + legacy fallback).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-30-me-rank-perf.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  bucketLabelFromThb,
  buildNextRankBucketHint,
  computeUserMonthlyRank,
  computeUserMonthlyRankLegacy,
} from '@/lib/referral/compute-user-monthly-rank.js'

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

describe('stage-202-30 me/rank perf', () => {
  it('migration mirrors referral_ledger_leaderboard_for_period filters', () => {
    const sql = read('migrations/stage202_30_referral_user_rank_for_period_rpc.sql')
    assert.match(sql, /referral_user_rank_for_period\s*\(\s*p_user_id\s+text/)
    assert.match(sql, /status = 'earned'/)
    assert.match(sql, /earned_at IS NOT NULL/)
    assert.match(sql, /earned_at >= p_period_start/)
    assert.match(sql, /earned_at < p_period_end_exclusive/)
    assert.match(sql, /row_number\(\) OVER \(ORDER BY earned DESC, referrer_id ASC\)/)
    assert.doesNotMatch(sql, /guest_booking/)
    assert.doesNotMatch(sql, /created_at/)
    assert.doesNotMatch(sql, /RANK\(\)/)
  })

  it('computeUserMonthlyRank uses referral_user_rank_for_period RPC', () => {
    const src = read('lib/referral/compute-user-monthly-rank.js')
    assert.match(src, /\.rpc\('referral_user_rank_for_period'/)
    assert.match(src, /computeUserMonthlyRankLegacy/)
  })

  it('route delegates to computeUserMonthlyRank and keeps cache 600s', () => {
    const src = read('app/api/v2/referral/me/rank/route.js')
    assert.match(src, /computeUserMonthlyRank/)
    assert.match(src, /unstable_cache/)
    assert.match(src, /CACHE_TTL_SEC\s*=\s*600/)
    assert.doesNotMatch(src, /from\('referral_ledger'\)/)
  })

  it('route return shape unchanged for ReferralProfilePage consumers', () => {
    const src = read('app/api/v2/referral/me/rank/route.js')
    assert.match(src, /\brank:/)
    assert.match(src, /total_ambassadors:/)
    assert.match(src, /as_of:/)
    assert.match(src, /earned_bucket_thb:/)
    assert.match(src, /next_rank_bucket_hint:/)
    assert.doesNotMatch(src, /success:\s*true/)
  })

  it('computeUserMonthlyRank RPC path maps row to rank contract', async () => {
    const supabase = {
      rpc: async () => ({
        data: [
          {
            rank: 2,
            total_ambassadors: 5,
            my_earned_thb: 15000,
            above_earned_thb: 20000,
          },
        ],
        error: null,
      }),
    }
    const result = await computeUserMonthlyRank(supabase, 'user-a', 'UTC')
    assert.equal(result.rank, 2)
    assert.equal(result.total_ambassadors, 5)
    assert.equal(result.my_earned_thb, 15000)
    assert.equal(result.earned_bucket_thb, bucketLabelFromThb(15000))
    assert.match(result.next_rank_bucket_hint, /1/)
  })

  it('computeUserMonthlyRank returns null rank when earned is 0', async () => {
    const supabase = {
      rpc: async () => ({
        data: [{ rank: null, total_ambassadors: 3, my_earned_thb: 0, above_earned_thb: null }],
        error: null,
      }),
    }
    const result = await computeUserMonthlyRank(supabase, 'user-b', 'UTC')
    assert.equal(result.rank, null)
    assert.equal(result.total_ambassadors, 3)
    assert.equal(result.my_earned_thb, 0)
    assert.equal(result.earned_bucket_thb, undefined)
  })

  it('computeUserMonthlyRank falls back to legacy when RPC missing', async () => {
    const rows = [
      { referrer_id: 'u1', amount_thb: 100 },
      { referrer_id: 'u2', amount_thb: 50 },
    ]
    const supabase = {
      rpc: async () => ({
        data: null,
        error: { message: 'Could not find the function referral_user_rank_for_period' },
      }),
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lt: async () => ({ data: rows, error: null }),
            }),
          }),
        }),
      }),
    }
    const result = await computeUserMonthlyRankLegacy(supabase, 'u1', {
      monthStartUtcIso: '2026-09-01T00:00:00.000Z',
      monthEndExclusiveUtcIso: '2026-10-01T00:00:00.000Z',
    })
    assert.equal(result.rank, 1)
    assert.equal(result.total_ambassadors, 2)
    assert.equal(result.my_earned_thb, 100)

    const viaMain = await computeUserMonthlyRank(supabase, 'u1', 'UTC')
    assert.equal(viaMain.rank, 1)
  })

  it('buildNextRankBucketHint stays bucket-level not exact THB', () => {
    const hint = buildNextRankBucketHint(3, 12345)
    assert.match(hint, /2/)
    assert.doesNotMatch(hint, /12345/)
  })
})
