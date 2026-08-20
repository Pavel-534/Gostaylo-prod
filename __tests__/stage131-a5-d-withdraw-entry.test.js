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
