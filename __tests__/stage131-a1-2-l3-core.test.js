/**
 * Stage 131.A1.2 — L3 core (split, resolver, gate, consent, caps).
 * Leaf imports only — referral-payout.service.js pulls Next/pricing and cannot run in node:test.
 *
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a1-2-l3-core.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { FINTECH_CONFIG_DEFAULTS } = require('../lib/config/fintech-config-defaults.js')
const {
  deriveGuestPoolSplit,
  resolveLiveGuestPoolPayout,
  resolveL3AccrualEligibility,
  applyL3BookingAndMonthlyCaps,
  resolveGuestL3ReferrerId,
} = require('../lib/services/marketing/referral-guest-pool-payout-split.js')

const LIVE_L3_POLICY = {
  ambassadorGuestL2Enabled: true,
  ambassadorGuestL3Enabled: true,
  ambassadorGuestPoolL1Percent: 42,
  ambassadorGuestPoolL2Percent: 10,
  ambassadorGuestPoolL3Percent: 5,
  ambassadorGuestPoolRefereePercent: 43,
  ambassadorGuestL3MinDirectPartners: 10,
}

const LEGACY_POLICY = {
  ambassadorGuestL2Enabled: true,
  ambassadorGuestL3Enabled: false,
  ambassadorGuestPoolL1Percent: 45,
  ambassadorGuestPoolL2Percent: 12,
  ambassadorGuestPoolL3Percent: 0,
  ambassadorGuestPoolRefereePercent: 43,
}

/** A invited B invited C invited guest. Path on guest relation = [A, B, C]. */
const TREE = {
  A: 'user-a-l3',
  B: 'user-b-l2',
  C: 'user-c-l1',
  guest: 'user-guest',
}

function guestRelation() {
  return {
    referrer_id: TREE.C,
    referee_id: TREE.guest,
    ancestor_path: [TREE.A, TREE.B, TREE.C],
    network_depth: 3,
  }
}

describe('Stage 131.A1.2 — L3 core', () => {
  it('1. happy path A→B→C→guest: L1=C L2=B L3=A, 42/10/5/43 sums to pool', () => {
    const relation = guestRelation()
    assert.equal(resolveGuestL3ReferrerId(relation), TREE.A)

    const pool = 10_000
    const split = deriveGuestPoolSplit(pool, LIVE_L3_POLICY)
    const paid = split.l1AmountThb + split.l2AmountThb + split.l3AmountThb + split.refereeAmountThb
    assert.equal(split.l1AmountThb, 4200)
    assert.equal(split.l2AmountThb, 1000)
    assert.equal(split.l3AmountThb, 500)
    assert.equal(split.refereeAmountThb, 4300)
    assert.ok(Math.abs(paid - pool) <= 1)
    assert.equal(split.l3WithheldThb, 0)

    const elig = resolveL3AccrualEligibility({
      l3Enabled: true,
      l3ReferrerId: TREE.A,
      hasConsent: true,
      partnerCount: 10,
      minDirectPartners: 10,
    })
    assert.equal(elig.pay, true)
    assert.equal(elig.writeShadow, false)
  })

  it('2. L3 gate fail (<10 PARTNERs): no pay, shadow withhold, referee unchanged', () => {
    const pool = 10_000
    const split = deriveGuestPoolSplit(pool, LIVE_L3_POLICY)
    const elig = resolveL3AccrualEligibility({
      l3Enabled: true,
      l3ReferrerId: TREE.A,
      hasConsent: true,
      partnerCount: 5,
      minDirectPartners: 10,
    })
    assert.equal(elig.pay, false)
    assert.equal(elig.writeShadow, true)
    assert.equal(elig.reason, 'L3_GATE_FAIL')
    assert.equal(split.l3AmountThb, 500)
    assert.equal(split.refereeAmountThb, 4300)
  })

  it('3. L3 consent fail: no pay, shadow withhold, L1/L2/referee amounts unchanged', () => {
    const pool = 10_000
    const split = deriveGuestPoolSplit(pool, LIVE_L3_POLICY)
    const elig = resolveL3AccrualEligibility({
      l3Enabled: true,
      l3ReferrerId: TREE.A,
      hasConsent: false,
      partnerCount: 20,
      minDirectPartners: 10,
    })
    assert.equal(elig.pay, false)
    assert.equal(elig.writeShadow, true)
    assert.equal(elig.reason, 'L3_CONSENT_FAIL')
    assert.equal(split.l1AmountThb, 4200)
    assert.equal(split.l2AmountThb, 1000)
    assert.equal(split.refereeAmountThb, 4300)
  })

  it('4. L3 per-booking cap: 5% of 1_000_000 pool → 500 live + 49_500 deferred', () => {
    const pool = 1_000_000
    const split = deriveGuestPoolSplit(pool, LIVE_L3_POLICY)
    assert.equal(split.l3AmountThb, 50_000)
    const capped = applyL3BookingAndMonthlyCaps({
      rawThb: split.l3AmountThb,
      perBookingCap: 500,
      monthlySpentThb: 0,
      monthlyCap: 20_000,
    })
    assert.equal(capped.finalThb, 500)
    assert.equal(capped.deferredAmountThb, 49_500)
    assert.equal(capped.cappedByBooking, true)
  })

  it('5. L3 monthly cap: after 20_000 THB spent, further L3 is 0 and shadow grows', () => {
    // TZ "50 bookings × 1000 pool × 5%" = 2_500 < 20k — does not hit the cap.
    // Intent: monthly 20k exhaust. 400 × 50 THB fills the cap; 401st is withheld.
    let spent = 0
    const monthlyCap = 20_000
    const raw = 50
    for (let i = 0; i < 400; i += 1) {
      const c = applyL3BookingAndMonthlyCaps({
        rawThb: raw,
        perBookingCap: 500,
        monthlySpentThb: spent,
        monthlyCap,
      })
      assert.equal(c.finalThb, 50)
      spent += c.finalThb
    }
    assert.equal(spent, 20_000)
    const after = applyL3BookingAndMonthlyCaps({
      rawThb: raw,
      perBookingCap: 500,
      monthlySpentThb: spent,
      monthlyCap,
    })
    assert.equal(after.finalThb, 0)
    assert.equal(after.deferredAmountThb, 50)
    assert.equal(after.cappedByMonthly, true)
  })

  it('6. l3_enabled=false: 45/12/0/43 L1/L2/referee regression, no L3 row plan', () => {
    const pool = 10_000
    const split = deriveGuestPoolSplit(pool, LEGACY_POLICY)
    const live = resolveLiveGuestPoolPayout(pool, LEGACY_POLICY)
    assert.equal(split.l1AmountThb, 4500)
    assert.equal(split.l2AmountThb, 1200)
    assert.equal(split.l3AmountThb, 0)
    assert.equal(split.refereeAmountThb, 4300)
    assert.equal(live.l3AmountThb, 0)
    assert.equal(live.l2WithheldThb, 0)
    assert.equal(live.referrerAmountThb, 4500)
    assert.equal(live.l2AmountThb, 1200)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_l3_enabled, false)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l1_percent, 45)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l2_percent, 12)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l3_percent, 0)
    assert.equal(FINTECH_CONFIG_DEFAULTS.referral_monthly_program_cap_thb, 250_000)

    const elig = resolveL3AccrualEligibility({
      l3Enabled: false,
      l3ReferrerId: TREE.A,
      hasConsent: true,
      partnerCount: 99,
      minDirectPartners: 10,
    })
    assert.equal(elig.pay, false)
    assert.equal(elig.writeShadow, false)
    assert.equal(elig.reason, 'L3_DISABLED')
  })

  it('resolver: short tree has no L3; L3 ≠ L1/L2', () => {
    assert.equal(
      resolveGuestL3ReferrerId({ referrer_id: TREE.C, ancestor_path: [TREE.B, TREE.C] }),
      null,
    )
    assert.equal(resolveGuestL3ReferrerId({ referrer_id: TREE.C, ancestor_path: [] }), null)
  })
})
