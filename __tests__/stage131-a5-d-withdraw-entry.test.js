/**
 * Stage 131.A5.D — guest ambassador withdraw UX entry points.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a5-d-withdraw-entry.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 131.A5.D — referral withdraw entry UX', () => {
  it('referral tabs sit under hub (sticky), with overview + link first', () => {
    const src = read('components/referral/ReferralProfilePage.jsx')
    assert.match(src, /ProfileHubNav/)
    assert.match(src, /stage131a5_tabOverview/)
    assert.match(src, /sticky top-0/)
    // Tabs must appear before heavy overview content mount order: TabsList then overview content
    const hubIdx = src.indexOf('<ProfileHubNav')
    const tabsIdx = src.indexOf('data-testid="referral-profile-tabs"')
    const overviewIdx = src.indexOf('value="overview"')
    assert.ok(hubIdx >= 0 && tabsIdx > hubIdx)
    assert.ok(overviewIdx > 0)
  })

  it('waterfall keeps RU form at zero balance when setup forced', () => {
    const src = read('components/referral/ReferralWithdrawalWaterfall.jsx')
    assert.match(src, /forceShowProfile/)
    assert.match(src, /showProfileOnly/)
    assert.match(src, /needsRuPayoutProfileSetup/)
  })

  it('payout blockers scroll to form on wallet instead of only reloading hash', () => {
    const src = read('components/referral/ReferralPayoutBlockers.jsx')
    assert.match(src, /focusRuPayoutProfile/)
    assert.match(src, /handleRuSetupClick/)
  })

  it('progress ladder shows current withdraw % and all tiers', () => {
    const src = read('components/referral/ReferralProfilePage.jsx')
    assert.match(src, /stage131a5_progressCurrentWithPct/)
    assert.match(src, /referral-tier-ladder/)
    assert.match(src, /stage131a5_progressGoalHint/)
    assert.match(src, /currentRewardPct/)
  })

  it('calculator resets demo avg per currency with display-currency floor', () => {
    const src = read('components/referral/ReferralCalculatorV2.jsx')
    assert.match(src, /DEMO_AVG_BY_CURRENCY/)
    assert.match(src, /demoAvgForCurrency/)
    assert.match(src, /CALC_AVG_MIN/)
    assert.match(src, /stage131a5_calcCurrencyHint/)
  })

  it('wallet hides partner payout CTA unless partner access', () => {
    const src = read('app/(storefront)/profile/wallet/page.js')
    assert.match(src, /showPartnerPayoutCta/)
    assert.match(src, /isPartner|canAccessPartner/)
    assert.match(src, /action=payout-setup|walletAction/)
    assert.match(src, /ru-payout-profile/)
  })

  it('RU profile form has stable anchor id', () => {
    const src = read('components/referral/ReferralRuPayoutProfileForm.jsx')
    assert.match(src, /id="ru-payout-profile"/)
  })

  it('blocker copy points to bank details + payout-setup deep link', () => {
    const details = read('lib/referral/payout-blocker-details.js')
    assert.match(details, /action=payout-setup/)
    assert.match(details, /БИК, номер счёта, ИНН/)
    assert.doesNotMatch(details, /#ru-payout-profile/)

    const i18n = read('lib/translations/slices/profile-app-referral.js')
    assert.match(
      i18n,
      /Укажите банковские реквизиты РФ \(БИК, номер счёта, ИНН\) для выплаты на карту любого банка РФ/,
    )
    assert.match(i18n, /stage131a5_withdrawCtaSetupRu/)
    assert.match(i18n, /stage131a5_withdrawCtaRequest/)
    assert.doesNotMatch(i18n, /2600/)
  })

  it('referral + status wire ReferralWithdrawEntryCta', () => {
    assert.match(read('components/referral/ReferralProfilePage.jsx'), /ReferralWithdrawEntryCta/)
    assert.match(read('app/(storefront)/profile/status/page.js'), /ReferralWithdrawEntryCta/)
    const cta = read('components/referral/ReferralWithdrawEntryCta.jsx')
    assert.match(cta, /formatMinPayoutThreshold/)
    assert.match(cta, /action=payout-setup/)
    assert.match(cta, /action=withdraw/)
  })
})
