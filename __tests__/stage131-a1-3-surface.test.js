/**
 * Stage 131.A1.3 — surface helpers (quarter bounds, dual spend alerts).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a1-3-surface.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { resolveLastClosedQuarterUtc } = require('../lib/referral/last-closed-quarter-utc.js')
const {
  deriveReferralSpendAlertThresholds,
  resolveReferralSpendAlertFlags,
} = require('../lib/admin/referral-spend-alert-thresholds.js')
const { FINTECH_CONFIG_DEFAULTS } = require('../lib/config/fintech-config-defaults.js')

describe('Stage 131.A1.3 — surface helpers', () => {
  it('last closed quarter: 2026-08-19 UTC → Q2 2026', () => {
    const q = resolveLastClosedQuarterUtc(new Date('2026-08-19T11:00:00.000Z'))
    assert.equal(q.periodStart, '2026-04-01')
    assert.equal(q.periodEnd, '2026-06-30')
    assert.equal(q.year, 2026)
    assert.equal(q.quarter, 2)
    assert.equal(q.startIso, '2026-04-01T00:00:00.000Z')
    assert.equal(q.endExclusiveIso, '2026-07-01T00:00:00.000Z')
  })

  it('last closed quarter: 2026-01-01 UTC → Q4 2025', () => {
    const q = resolveLastClosedQuarterUtc(new Date('2026-01-01T00:00:00.000Z'))
    assert.equal(q.periodStart, '2025-10-01')
    assert.equal(q.periodEnd, '2025-12-31')
    assert.equal(q.year, 2025)
    assert.equal(q.quarter, 4)
  })

  it('early warning 150k and 80% of 250k cap are independent', () => {
    const th = deriveReferralSpendAlertThresholds({
      monthlySpendAlertThb: 150_000,
      programCapThb: 250_000,
    })
    assert.equal(th.monthlySpendAlertThb, 150_000)
    assert.equal(th.programCapWarnThb, 200_000)

    const mid = resolveReferralSpendAlertFlags(160_000, th)
    assert.equal(mid.earlyWarningTriggered, true)
    assert.equal(mid.approachingCapTriggered, false)

    const both = resolveReferralSpendAlertFlags(210_000, th)
    assert.equal(both.earlyWarningTriggered, true)
    assert.equal(both.approachingCapTriggered, true)
  })

  it('80% of 1M cap is 800k', () => {
    const th = deriveReferralSpendAlertThresholds({
      monthlySpendAlertThb: 150_000,
      programCapThb: 1_000_000,
    })
    assert.equal(th.programCapWarnThb, 800_000)
  })

  it('A1.1/A1.2 defaults unchanged: L3 off, 45/12/43, cap 250k', () => {
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_l3_enabled, false)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l1_percent, 45)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l2_percent, 12)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_l3_percent, 0)
    assert.equal(FINTECH_CONFIG_DEFAULTS.ambassador_guest_pool_referee_percent, 43)
    assert.equal(FINTECH_CONFIG_DEFAULTS.referral_monthly_program_cap_thb, 250_000)
  })
})
