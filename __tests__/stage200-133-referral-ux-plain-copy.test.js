/**
 * Stage 200.133 — referral hub: tab scroll SSOT, no blocker codes / FX markup jargon, localized tiers.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-133-referral-ux-plain-copy.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.133 — referral UX plain copy', () => {
  it('tabs list uses justify-start (not center) so first tab is scrollable into view', () => {
    const src = read('components/referral/ReferralProfilePage.jsx')
    assert.match(src, /TABS_LIST_CLASS[\s\S]*justify-start/)
    assert.match(src, /inline:\s*['"]nearest['"]/)
    // Comment may mention default justify-center; class must not apply it
    assert.match(src, /justify-start beats TabsList default justify-center/)
    assert.doesNotMatch(src, /TABS_LIST_CLASS\s*=\s*'[^']*justify-center/)
  })

  it('payout blockers never render raw machine codes to users', () => {
    const blockers = read('components/referral/ReferralPayoutBlockers.jsx')
    assert.doesNotMatch(blockers, /font-mono/)
    assert.match(blockers, /resolveMessage\(row\)/)
    assert.match(blockers, /key=\{row\.code\}/)
    // Message body must not interpolate the machine code
    assert.doesNotMatch(blockers, /\{row\.code\}\s*<\/p>/)
    assert.doesNotMatch(blockers, /code\}\s*<\/span>/)

    const details = read('lib/referral/payout-blocker-details.js')
    assert.doesNotMatch(details, /\$\{code\}/)
    assert.match(details, /Вывод временно недоступен\. Обратитесь в поддержку/)
  })

  it('localizeReferralTierName maps Beginner/Pro/Ambassador for RU', () => {
    const { localizeReferralTierName } = require('../lib/referral/localize-referral-tier-name.js')
    const map = {
      stage73_tierFallbackBeginner: 'Новичок',
      stage73_tierFallbackPro: 'Профи',
      stage73_tierFallbackAmbassador: 'Амбассадор',
    }
    const t = (k) => map[k] || k
    assert.equal(localizeReferralTierName('Beginner', t), 'Новичок')
    assert.equal(localizeReferralTierName('Pro', t), 'Профи')
    assert.equal(localizeReferralTierName('Ambassador', t), 'Амбассадор')
    assert.equal(localizeReferralTierName('', t), 'Новичок')
  })

  it('status card + levels + stories use localizeReferralTierName', () => {
    assert.match(read('components/referral/ReferralYourStatusCard.jsx'), /localizeReferralTierName/)
    assert.match(read('components/referral/ReferralAmbassadorLevels.jsx'), /localizeReferralTierName/)
    assert.match(read('components/referral/ReferralProfileTabLink.jsx'), /localizeReferralTierName/)
    assert.match(read('components/referral/ReferralProfileTabEarnings.jsx'), /localizeReferralTierName/)
  })

  it('referral i18n has no mid-market / rate lock / витринная / markup jargon for users', () => {
    const src = read('lib/translations/slices/profile-app-referral.js')
    assert.doesNotMatch(src, /mid-market/i)
    assert.doesNotMatch(src, /rate lock/i)
    assert.doesNotMatch(src, /витринн/i)
    assert.doesNotMatch(src, /наценк/i)
    assert.doesNotMatch(src, /storefront markup/i)
    assert.doesNotMatch(src, /retail spread/i)
    assert.doesNotMatch(src, /биржев/i)
    assert.doesNotMatch(src, /\{code\}/)
    assert.match(src, /stage73_tierFallbackBeginner:\s*"Новичок"/)
    assert.match(src, /stage1143_tabLink:\s*"Ссылка"/)
  })

  it('partner finances midFx hint does not mention storefront markup', () => {
    const src = read('lib/translations/slices/partner-finances.js')
    assert.doesNotMatch(src, /storefront markup/i)
    assert.doesNotMatch(src, /витринн/i)
  })

  it('referral balance / monthly goal do not show always-on ≈ FX course line', () => {
    const balance = read('components/referral/ReferralBalanceBreakdown.jsx')
    assert.doesNotMatch(balance, /MidFxFootnote/)
    assert.doesNotMatch(balance, /stage1797_midFxHint/)
    const goal = read('components/referral/ReferralMonthlyGoalCard.jsx')
    assert.doesNotMatch(goal, /stage1797_midFxHint/)
    assert.doesNotMatch(goal, /isConvertedDisplay/)
  })
})
