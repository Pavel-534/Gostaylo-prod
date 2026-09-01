/**
 * Stage 202.25 — snapshot coverage + insurance SSOT unit tests.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage-202-25-snapshot-coverage.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  FINTECH_CONFIG_DEFAULTS,
  INSURANCE_FUND_PERCENT_DEFAULT,
} from '@/lib/config/fintech-config-defaults.js'
import {
  getFrozenPolicyConfig,
  buildFrozenFintechSnapshotPayload,
  bookingLacksValidFintechSnapshot,
  isPreCutoverBooking,
} from '@/lib/services/finance/fintech-snapshot-freeze.service.js'
import {
  resolveFintechPolicyForBooking,
  FinSnapshotMissingError,
  readFintechSnapshotFromBooking,
} from '@/lib/services/finance/fintech-snapshot.service.js'
import {
  readInsuranceFundPercent,
  computeInsuranceReserveThb,
} from '@/lib/services/finance/fintech-insurance.service.js'
import { computeWaterfallPreview } from '@/lib/services/finance/fintech-waterfall.js'
import { normalizeFintechSettingsRow } from '@/lib/services/finance/system-config.service.js'

describe('stage-202-25 snapshot coverage + insurance SSOT', () => {
  it('getFrozenPolicyConfig contains owner cutover canon keys', () => {
    const frozen = getFrozenPolicyConfig()
    assert.equal(frozen.referralReinvestmentPercent, 45)
    assert.equal(frozen.acquiringFeePercent, 4.3)
    assert.equal(frozen.ambassadorGuestPoolL1Percent, 42)
    assert.equal(frozen.ambassadorGuestPoolL2Percent, 10)
    assert.equal(frozen.ambassadorGuestPoolL3Percent, 5)
    assert.equal(frozen.ambassadorGuestPoolRefereePercent, 43)
    assert.equal(frozen.referralMonthlyProgramCapThb, 1_000_000)
    assert.equal(frozen.ambassadorGuestL3Enabled, true)
    assert.equal(frozen.insuranceFundPercent, 0.5)
    assert.equal(frozen.usnProvisionPercent, 6)
    assert.equal(frozen.vatProvisionPercent, 5)
    assert.equal(frozen.reserveBankPercent, 0.5)
  })

  it('buildFrozenFintechSnapshotPayload uses v=1 + frozen + config shape', () => {
    const snap = buildFrozenFintechSnapshotPayload()
    assert.equal(snap.v, 1)
    assert.equal(snap.frozen, true)
    assert.ok(snap.config && typeof snap.config === 'object')
    assert.equal(readFintechSnapshotFromBooking({ metadata: { fintech_snapshot: snap } })?.config?.referralReinvestmentPercent, 45)
  })

  it('resolveFintechPolicyForBooking with snapshot.frozen=true → snapshot_frozen source', async () => {
    const config = normalizeFintechSettingsRow({ referral_reinvestment_percent: 40 })
    const booking = {
      id: 'b-frozen',
      created_at: '2026-09-01T00:00:00.000Z',
      metadata: {
        fintech_snapshot: { v: 1, frozen: true, config },
      },
    }
    const policy = await resolveFintechPolicyForBooking(booking)
    assert.equal(policy.referralReinvestmentPercent, 40)
    assert.equal(policy._source, 'snapshot_frozen')
  })

  it('resolveFintechPolicyForBooking with snapshot (no frozen) → snapshot source', async () => {
    const config = normalizeFintechSettingsRow({ referral_reinvestment_percent: 44 })
    const booking = {
      id: 'b-snap',
      created_at: '2026-09-01T00:00:00.000Z',
      metadata: { fintech_snapshot: { v: 1, config } },
    }
    const policy = await resolveFintechPolicyForBooking(booking)
    assert.equal(policy.referralReinvestmentPercent, 44)
    assert.equal(policy._source, 'snapshot')
  })

  it('resolveFintechPolicyForBooking without snapshot + pre-cutover → frozen default', async () => {
    const booking = { id: 'b-old', created_at: '2026-01-01T00:00:00.000Z', metadata: {} }
    const policy = await resolveFintechPolicyForBooking(booking)
    assert.equal(policy.referralReinvestmentPercent, 45)
    assert.equal(policy._source, 'frozen_default_pre_cutover')
  })

  it('resolveFintechPolicyForBooking without snapshot + post-cutover → FIN_SNAPSHOT_MISSING', async () => {
    const booking = { id: 'b-new', created_at: '2026-09-01T00:00:00.000Z', metadata: {} }
    await assert.rejects(
      () => resolveFintechPolicyForBooking(booking),
      (err) => err instanceof FinSnapshotMissingError && err.code === 'FIN_SNAPSHOT_MISSING_FOR_NEW_BOOKING',
    )
  })

  it('resolveFintechPolicyForBooking without booking → live config (no throw)', async () => {
    const policy = await resolveFintechPolicyForBooking(null)
    assert.equal(typeof policy.referralReinvestmentPercent, 'number')
    assert.equal(policy._source, undefined)
  })

  it('fintech-waterfall uses insurance from policy, not hardcoded 0.005', () => {
    const config = normalizeFintechSettingsRow({ insurance_fund_percent: 0.7 })
    const preview = computeWaterfallPreview(config, { subtotalThb: 10_000, guestServiceFeePercent: 15 })
    assert.equal(preview.feeBase.platformGrossRevenueThb, 1500)
    assert.equal(preview.feeBase.insuranceReserveThb, 10.5)
  })

  it('FINTECH_CONFIG_DEFAULTS.insurance_fund_percent === 0.5', () => {
    assert.equal(FINTECH_CONFIG_DEFAULTS.insurance_fund_percent, 0.5)
    assert.equal(INSURANCE_FUND_PERCENT_DEFAULT, 0.5)
  })

  it('readInsuranceFundPercent rejects out-of-range values', () => {
    assert.throws(() => readInsuranceFundPercent({ insuranceFundPercent: -1 }), /OUT_OF_RANGE/)
    assert.throws(() => readInsuranceFundPercent({ insuranceFundPercent: 11 }), /OUT_OF_RANGE/)
  })

  it('computeInsuranceReserveThb on 35k / 15% guest fee → 26.25 THB at 0.5%', () => {
    const thb = computeInsuranceReserveThb(5250, { insuranceFundPercent: 0.5 })
    assert.equal(thb, 26.25)
  })

  it('bookingLacksValidFintechSnapshot + isPreCutoverBooking helpers', () => {
    assert.equal(bookingLacksValidFintechSnapshot({ metadata: {} }), true)
    assert.equal(isPreCutoverBooking({ created_at: '2026-01-01T00:00:00.000Z' }), true)
    assert.equal(isPreCutoverBooking({ created_at: '2026-09-01T00:00:00.000Z' }), false)
  })
})
