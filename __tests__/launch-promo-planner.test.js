/**
 * Launch promo planner unit tests.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/launch-promo-planner.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeLaunchPromoPlan,
  fintechSettingsToPolicy,
  LAUNCH_PLANNER_REINVESTMENT_MAX,
  LAUNCH_PLANNER_REINVESTMENT_MIN,
  LAUNCH_PLANNER_SUBTOTAL_MIN,
  normalizePlannerInputs,
} from '@/lib/admin/launch-promo-planner.js'
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'

const LIVE_LIKE = {
  acquiring_fee_percent: 4.3,
  usn_provision_percent: 6,
  vat_provision_percent: 5,
  reserve_bank_percent: 0.5,
  referral_reinvestment_percent: 45,
  ambassador_guest_l2_enabled: true,
  ambassador_guest_l3_enabled: true,
  ambassador_guest_pool_l1_percent: 42,
  ambassador_guest_pool_l2_percent: 10,
  ambassador_guest_pool_l3_percent: 5,
  ambassador_guest_pool_referee_percent: 43,
  referral_monthly_program_cap_thb: 1_000_000,
  partner_activation_bonus_thb: 500,
  ambassador_3_waterfall_enabled: true,
}

describe('launch-promo-planner', () => {
  it('clamps subtotal min 1000 and reinvestment 30-80', () => {
    const inputs = normalizePlannerInputs({
      subtotalThb: 500,
      referralReinvestmentPercent: 99,
    })
    assert.equal(inputs.subtotalThb, LAUNCH_PLANNER_SUBTOTAL_MIN)
    assert.equal(inputs.referralReinvestmentPercent, LAUNCH_PLANNER_REINVESTMENT_MAX)
  })

  it('45% reinvestment on 10k matches SSOT waterfall order', () => {
    const policy = fintechSettingsToPolicy(LIVE_LIKE, { referralReinvestmentPercent: 45 })
    const plan = computeLaunchPromoPlan(
      policy,
      normalizePlannerInputs({
        subtotalThb: 10_000,
        guestServiceFeePercent: 15,
        referralReinvestmentPercent: 45,
        totalBookingsPerMonth: 10,
        referralBookingsPerMonth: 10,
      }),
    )
    const pb = plan.perBookingReferral
    assert.ok(pb.deductions.acquiringFeeThb > 0)
    assert.ok(pb.adjustedNetThb > pb.referralPoolThb)
    assert.equal(
      round2(pb.referralPoolThb + pb.ownerRetainedThb),
      pb.adjustedNetThb,
    )
    assert.ok(pb.referralPoolThb > 350 && pb.referralPoolThb < 380)
    assert.ok(pb.split.l3AmountThb > 0)
  })

  it('80% reinvestment leaves less owner retained than 45%', () => {
    const policy = fintechSettingsToPolicy(LIVE_LIKE)
    const base = normalizePlannerInputs({
      subtotalThb: 10_000,
      referralReinvestmentPercent: 45,
      totalBookingsPerMonth: 1,
      referralBookingsPerMonth: 1,
    })
    const high = normalizePlannerInputs({ ...base, referralReinvestmentPercent: 80 })
    const low = computeLaunchPromoPlan(policy, base)
    const hi = computeLaunchPromoPlan(policy, high)
    assert.ok(hi.perBookingReferral.ownerRetainedThb < low.perBookingReferral.ownerRetainedThb)
    assert.ok(hi.perBookingReferral.referralPoolThb > low.perBookingReferral.referralPoolThb)
  })

  it('monthly cap warning when pool exceeds program cap', () => {
    const policy = fintechSettingsToPolicy({
      ...LIVE_LIKE,
      referral_monthly_program_cap_thb: 100_000,
    })
    const plan = computeLaunchPromoPlan(
      policy,
      normalizePlannerInputs({
        subtotalThb: 35_000,
        referralReinvestmentPercent: 80,
        totalBookingsPerMonth: 500,
        referralBookingsPerMonth: 500,
      }),
    )
    assert.equal(plan.monthly.capExceeded, true)
    assert.ok(plan.warnings.some((w) => w.includes('program cap')))
  })

  it('fintechSettingsToPolicy uses defaults when api null', () => {
    const p = fintechSettingsToPolicy(null)
    assert.equal(p.acquiringFeePercent, FINTECH_CONFIG_DEFAULTS.acquiring_fee_percent)
  })
})

function round2(n) {
  return Math.round(Number(n) * 100) / 100
}
