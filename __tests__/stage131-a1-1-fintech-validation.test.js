/**
 * Stage 131.A1.1 — guest pool split validation (L3 envelope).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a1-1-fintech-validation.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const {
  validateGuestPoolSplit,
} = require('../lib/services/finance/guest-pool-split-validation.js')
const { FINTECH_CONFIG_DEFAULTS } = require('../lib/config/fintech-config-defaults.js')

function policy(overrides) {
  return {
    ambassadorGuestL2Enabled: true,
    ambassadorGuestPoolL1Percent: 45,
    ambassadorGuestPoolL2Percent: 12,
    ambassadorGuestPoolL3Percent: 0,
    ambassadorGuestPoolRefereePercent: 43,
    ambassadorGuestL3Enabled: false,
    ...overrides,
  }
}

describe('Stage 131.A1.1 — guest pool split validation', () => {
  it('L3 on: 42/10/5/43 sums to 100', () => {
    const r = validateGuestPoolSplit(
      policy({
        ambassadorGuestL3Enabled: true,
        ambassadorGuestPoolL1Percent: 42,
        ambassadorGuestPoolL2Percent: 10,
        ambassadorGuestPoolL3Percent: 5,
        ambassadorGuestPoolRefereePercent: 43,
      }),
    )
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'l3')
    assert.equal(r.errors.length, 0)
  })

  it('L3 on: 42/10/0/43 is rejected', () => {
    const r = validateGuestPoolSplit(
      policy({
        ambassadorGuestL3Enabled: true,
        ambassadorGuestPoolL1Percent: 42,
        ambassadorGuestPoolL2Percent: 10,
        ambassadorGuestPoolL3Percent: 0,
        ambassadorGuestPoolRefereePercent: 43,
      }),
    )
    assert.equal(r.ok, false)
    assert.equal(r.mode, 'l3')
    assert.ok(r.errors.some((e) => /must be 100, got 95\.00 \(mode: l3\)/.test(e)))
  })

  it('L3 off: legacy 45/12/43 is OK', () => {
    const r = validateGuestPoolSplit(
      policy({
        ambassadorGuestL3Enabled: false,
        ambassadorGuestPoolL1Percent: 45,
        ambassadorGuestPoolL2Percent: 12,
        ambassadorGuestPoolL3Percent: 0,
        ambassadorGuestPoolRefereePercent: 43,
      }),
    )
    assert.equal(r.ok, true)
    assert.equal(r.mode, 'legacy')
  })

  it('L3 off: l3 > 0 is rejected', () => {
    const r = validateGuestPoolSplit(
      policy({
        ambassadorGuestL3Enabled: false,
        ambassadorGuestPoolL3Percent: 5,
      }),
    )
    assert.equal(r.ok, false)
    assert.ok(r.errors.some((e) => /L3 percent must be 0/.test(e)))
  })

  it('A1.1 defaults keep L3 flag false and live 45/12/43', () => {
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_l3_enabled, false)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l1_percent, 45)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l2_percent, 12)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l3_percent, 0)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_referee_percent, 43)
    assert.equal(FINTECH_CONFIG_DEFAULTS.referral_monthly_program_cap_thb, 250_000)
  })
})
