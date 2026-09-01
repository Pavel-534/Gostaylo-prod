/**
 * Stage 202.27 — engagement perf (SQL sum RPC + route cache).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-27-engagement-perf.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  sumReferralEarnedThb,
  sumReferralEarnedThbLegacyReduce,
} from '@/lib/referral/qualified-host-metrics.js'

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

function round2(v) {
  return Math.round(Number(v) * 100) / 100
}

describe('stage-202-27 engagement perf', () => {
  it('migration defines referral_earned_thb_total(text) with earned + earned_held', () => {
    const sql = read('migrations/stage202_27_referral_earned_thb_total_rpc.sql')
    assert.match(sql, /referral_earned_thb_total\s*\(\s*p_referrer_id\s+text\s*\)/)
    assert.match(sql, /'earned',\s*'earned_held'/)
    assert.match(sql, /GRANT EXECUTE/)
  })

  it('bookings partial index already exists — no duplicate migration in 202.27', () => {
    const sql = read('migrations/stage136_01_referral_withdrawal_atomic_rpc.sql')
    assert.match(sql, /idx_bookings_partner_completed/)
    assert.match(sql, /WHERE status = 'COMPLETED'/)
    assert.doesNotMatch(read('migrations/stage202_27_referral_earned_thb_total_rpc.sql'), /idx_bookings/)
  })

  it('sumReferralEarnedThb calls RPC referral_earned_thb_total', () => {
    const src = read('lib/referral/qualified-host-metrics.js')
    assert.match(src, /\.rpc\('referral_earned_thb_total'/)
    assert.match(src, /sumReferralEarnedThbLegacyReduce/)
  })

  it('sumReferralEarnedThb RPC path returns rounded numeric', async () => {
    const supabase = {
      rpc: async () => ({ data: 123.456, error: null }),
    }
    assert.equal(await sumReferralEarnedThb(supabase, 'user-1'), 123.46)
  })

  it('sumReferralEarnedThb falls back to legacy reduce when RPC missing', async () => {
    const rows = [{ amount_thb: 10 }, { amount_thb: 20.5 }]
    const supabase = {
      rpc: async () => ({
        data: null,
        error: { message: 'Could not find the function referral_earned_thb_total' },
      }),
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async () => ({ data: rows, error: null }),
          }),
        }),
      }),
    }
    assert.equal(await sumReferralEarnedThb(supabase, 'user-2'), 30.5)
  })

  it('legacy reduce matches manual sum regression', async () => {
    const rows = [{ amount_thb: 100 }, { amount_thb: 0.333 }, { amount_thb: null }]
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async () => ({ data: rows, error: null }),
          }),
        }),
      }),
    }
    const legacy = await sumReferralEarnedThbLegacyReduce(supabase, 'u')
    const manual = round2(100 + 0.333)
    assert.equal(legacy, manual)
  })

  it('/engagement route uses unstable_cache + private Cache-Control', () => {
    const route = read('app/api/v2/referral/me/engagement/route.js')
    assert.match(route, /unstable_cache/)
    assert.match(route, /ENGAGEMENT_CACHE_REVALIDATE_SEC\s*=\s*60/)
    assert.match(route, /Cache-Control.*private,\s*max-age=60/)
    assert.match(route, /buildReferralEngagementPayload/)
  })

  it('client engagement query staleTime aligned with server cache (5 min)', () => {
    const hook = read('lib/hooks/use-referral-engagement.js')
    assert.match(hook, /staleTime:\s*5 \* 60_000/)
  })

  it('Stage 202.22 engagement contract still holds', () => {
    assert.match(read('app/api/v2/referral/me/engagement/route.js'), /getSessionPayload/)
    assert.match(read('lib/services/marketing/local-leader-metrics.service.js'), /computeQuestsProgress/)
    assert.doesNotMatch(read('app/api/v2/referral/me/engagement/route.js'), /fintech-waterfall/)
  })
})
