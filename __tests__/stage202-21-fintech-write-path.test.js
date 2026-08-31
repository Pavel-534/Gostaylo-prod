/**
 * Stage 202.21 — FinTech write-path hardening unit tests.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-21-fintech-write-path.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildMarketingSettingsPatch } from '@/lib/admin/settings-handlers/marketing-settings.js'
import {
  compareFintechLiveToOwnerCanon,
  findIgnoredFintechKeysInMarketingBody,
} from '@/lib/admin/fintech-owner-canon.js'
import { MARKETING_FINTECH_LEGACY_GENERAL_KEYS } from '@/lib/admin/marketing-fintech-legacy-keys.js'
import { stripFintechKeysFromGeneralValue } from '@/lib/services/finance/referral-fintech-admin-sync.js'
import { validateFintechSettingsUpdate } from '@/lib/services/finance/fintech-settings-validation.js'
import { normalizeFintechSettingsRow } from '@/lib/services/finance/system-config.service.js'
import { FINTECH_CONFIG_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'

const BASE_FINTECH_POLICY = {
  acquiringFeePercent: 4.3,
  referralReinvestmentPercent: 45,
  operationalReservePercent: 0,
  mlmLevel1Percent: 70,
  mlmLevel2Percent: 30,
}

const BASE_SAFETY = {
  guestServiceFeePercent: 15,
  hostCommissionPercent: 15,
  insuranceFundPercent: 1,
  taxRatePercent: 0,
  fintechPolicy: BASE_FINTECH_POLICY,
}

describe('stage202-21 fintech write-path', () => {
  it('stripFintechKeysFromGeneralValue removes legacy fintech keys', () => {
    const input = {
      marketing_promo_pot: 1000,
      acquiring_fee_percent: 0,
      referral_reinvestment_percent: 65,
      referralReinvestmentPercent: 65,
      mlm_level1_percent: 70,
    }
    const out = stripFintechKeysFromGeneralValue(input)
    assert.equal(out.marketing_promo_pot, 1000)
    for (const k of MARKETING_FINTECH_LEGACY_GENERAL_KEYS) {
      assert.equal(out[k], undefined)
    }
  })

  it('Marketing save with fintech keys in body → no fintechPatch, keys ignored', () => {
    const result = buildMarketingSettingsPatch(
      {
        acquiringFeePercent: 0,
        referralReinvestmentPercent: 80,
        referral_reinvestment_percent: 80,
        marketingPromoPot: 5000,
      },
      {},
      BASE_SAFETY,
    )
    assert.equal(result.ok, true)
    assert.ok(result.ignoredFintechKeys.length >= 2)
    assert.equal(result.fintechPatch, undefined)
    assert.equal(result.patch.marketing_promo_pot, 5000)
    assert.equal(result.patch.acquiring_fee_percent, undefined)
  })

  it('Marketing save without fintech keys → promo patch only', () => {
    const result = buildMarketingSettingsPatch(
      { marketingPromoPot: 777, promoBoostPerBooking: 50 },
      { marketing_promo_pot: 100 },
      BASE_SAFETY,
    )
    assert.equal(result.ok, true)
    assert.equal(result.ignoredFintechKeys.length, 0)
    assert.equal(result.patch.marketing_promo_pot, 777)
    assert.equal(result.patch.promo_boost_per_booking, 50)
  })

  it('validateFintechSettingsUpdate rejects acquiring=0 without acknowledgement', () => {
    const current = normalizeFintechSettingsRow(null)
    const blocked = validateFintechSettingsUpdate({ acquiring_fee_percent: 0 }, current)
    assert.equal(blocked.ok, false)
    assert.equal(blocked.error, 'DANGEROUS_ACQUIRING_ZERO')

    const allowed = validateFintechSettingsUpdate(
      { acquiring_fee_percent: 0, acknowledgeDangerousAcquiringZero: true },
      current,
    )
    assert.equal(allowed.ok, true, allowed.message || allowed.error)
  })

  it('cap default = 1_000_000 in fintech-config-defaults', () => {
    assert.equal(FINTECH_CONFIG_DEFAULTS.referral_monthly_program_cap_thb, 1_000_000)
  })

  it('compareFintechLiveToOwnerCanon detects drift on 4 banner keys', () => {
    const match = compareFintechLiveToOwnerCanon({
      referral_reinvestment_percent: 45,
      acquiring_fee_percent: 4.3,
      referral_monthly_program_cap_thb: 1_000_000,
      ambassador_guest_l3_enabled: true,
    })
    assert.equal(match.differs, false)

    const drift = compareFintechLiveToOwnerCanon({
      referral_reinvestment_percent: 65,
      acquiring_fee_percent: 0,
      referral_monthly_program_cap_thb: 250_000,
      ambassador_guest_l3_enabled: false,
    })
    assert.equal(drift.differs, true)
    assert.ok(drift.diff.referral_reinvestment_percent)
    assert.ok(drift.diff.acquiring_fee_percent)
    assert.ok(drift.diff.referral_monthly_program_cap_thb)
    assert.ok(drift.diff.ambassador_guest_l3_enabled)
  })

  it('findIgnoredFintechKeysInMarketingBody lists snake and camel keys', () => {
    const keys = findIgnoredFintechKeysInMarketingBody({
      acquiring_fee_percent: 0,
      referralReinvestmentPercent: 45,
      marketingPromoPot: 1,
    })
    assert.ok(keys.includes('acquiring_fee_percent'))
    assert.ok(keys.includes('referralReinvestmentPercent'))
    assert.ok(!keys.includes('marketingPromoPot'))
  })
})
