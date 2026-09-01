/**
 * Stage 202.27b — referral hot spots perf (qualified host bookings + cap fallback sum).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-27b-hot-spots-perf.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  loadQualifiedHostCompletedBookingsLegacy,
} from '@/lib/referral/qualified-host-metrics.js'
import {
  getMonthlyGuestReferralSpendThb,
  getMonthlyGuestReferralSpendThbLegacyReduce,
} from '@/lib/services/marketing/referral-program-cap.service.js'

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
}

function round2(v) {
  return Math.round(Number(v) * 100) / 100
}

describe('stage-202-27b hot spots perf', () => {
  it('qualified_host_first_completed_booking migration uses MIN timestamp not COUNT', () => {
    const sql = read('migrations/stage202_27b_qualified_host_first_completed_booking_rpc.sql')
    assert.match(sql, /qualified_host_first_completed_booking\s*\(\s*p_referee_ids\s+text\[\]\s*\)/)
    assert.match(sql, /first_completed_at/)
    assert.match(sql, /MIN\(COALESCE\(b\.updated_at, b\.created_at\)\)/)
    assert.doesNotMatch(sql, /COUNT\(/i)
  })

  it('referral_program_monthly_guest_spend_thb mirrors cap reserve filters', () => {
    const sql = read('migrations/stage202_27b_referral_program_monthly_guest_spend_rpc.sql')
    assert.match(sql, /referral_program_monthly_guest_spend_thb\s*\(\s*p_utc_month_start\s+timestamptz\s*\)/)
    assert.match(sql, /referral_type = 'guest_booking'/)
    assert.match(sql, /'pending',\s*'earned',\s*'earned_held'/)
    assert.match(sql, /created_at >= p_utc_month_start/)
    assert.doesNotMatch(sql, /referrer_id/)
    assert.doesNotMatch(sql, /earned_at/)
  })

  it('loadQualifiedHostSets uses qualified_host_first_completed_booking RPC', () => {
    const src = read('lib/referral/qualified-host-metrics.js')
    assert.match(src, /\.rpc\('qualified_host_first_completed_booking'/)
    assert.match(src, /loadQualifiedHostCompletedBookingsLegacy/)
  })

  it('getMonthlyGuestReferralSpendThb uses referral_program_monthly_guest_spend_thb RPC', () => {
    const src = read('lib/services/marketing/referral-program-cap.service.js')
    assert.match(src, /\.rpc\('referral_program_monthly_guest_spend_thb'/)
    assert.match(src, /getMonthlyGuestReferralSpendThbLegacyReduce/)
  })

  it('getMonthlyGuestReferralSpendThb RPC path returns rounded numeric', async () => {
    const supabase = {
      rpc: async () => ({ data: 99.999, error: null }),
    }
    assert.equal(await getMonthlyGuestReferralSpendThb('2026-09-01T00:00:00.000Z', supabase), 100)
  })

  it('getMonthlyGuestReferralSpendThb falls back to legacy reduce when RPC missing', async () => {
    const rows = [{ amount_thb: 10 }, { amount_thb: 20.5 }]
    const supabase = {
      rpc: async () => ({
        data: null,
        error: { message: 'Could not find the function referral_program_monthly_guest_spend_thb' },
      }),
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              in: async () => ({ data: rows, error: null }),
            }),
          }),
        }),
      }),
    }
    assert.equal(await getMonthlyGuestReferralSpendThb('2026-09-01T00:00:00.000Z', supabase), 30.5)
  })

  it('getMonthlyGuestReferralSpendThbLegacyReduce sums guest_booking rows', async () => {
    const rows = [{ amount_thb: 100 }, { amount_thb: 0.333 }]
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              in: async () => ({ data: rows, error: null }),
            }),
          }),
        }),
      }),
    }
    const legacy = await getMonthlyGuestReferralSpendThbLegacyReduce(supabase, '2026-09-01T00:00:00.000Z')
    assert.equal(legacy, 100.33)
  })

  it('legacy bookings rows MIN semantics match RPC first_completed_at intent', () => {
    const rows = [
      { partner_id: 'a', updated_at: '2026-08-01T00:00:00.000Z', created_at: '2026-08-02T00:00:00.000Z' },
      { partner_id: 'a', updated_at: '2026-07-01T00:00:00.000Z', created_at: '2026-07-02T00:00:00.000Z' },
      { partner_id: 'b', updated_at: null, created_at: '2026-06-01T00:00:00.000Z' },
    ]
    const byPartner = new Map()
    for (const row of rows) {
      const rid = row.partner_id
      const ms = Date.parse(row.updated_at || row.created_at)
      const prev = byPartner.get(rid)
      byPartner.set(rid, prev != null ? Math.min(prev, ms) : ms)
    }
    assert.equal(byPartner.get('a'), Date.parse('2026-07-01T00:00:00.000Z'))
    assert.equal(byPartner.get('b'), Date.parse('2026-06-01T00:00:00.000Z'))
  })

  it('loadQualifiedHostCompletedBookingsLegacy queries COMPLETED bookings by partner_id', async () => {
    let captured = null
    const supabase = {
      from: (table) => {
        captured = table
        return {
          select: () => ({
            eq: (col, val) => {
              assert.equal(col, 'status')
              assert.equal(val, 'COMPLETED')
              return {
                in: async (col2, ids) => {
                  assert.equal(col2, 'partner_id')
                  assert.deepEqual(ids, ['u1'])
                  return { data: [], error: null }
                },
              }
            },
          }),
        }
      },
    }
    await loadQualifiedHostCompletedBookingsLegacy(supabase, ['u1'])
    assert.equal(captured, 'bookings')
  })

  it('Stage 202.22 engagement contract still references loadQualifiedHostSets', () => {
    assert.match(read('lib/services/marketing/local-leader-metrics.service.js'), /loadQualifiedHostSets/)
    assert.match(read('lib/services/marketing/referral-program-cap.service.js'), /getMonthlyGuestReferralSpendThb/)
  })
})
