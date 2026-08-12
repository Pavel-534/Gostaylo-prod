/**
 * Stage 200.105 — Partner finances + payout-profiles section rhythm SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-105-partner-finances-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.105 — partner finances rhythm', () => {
  it('OverviewTab uses section titles + dividers for balance / withdraw', () => {
    const overview = read('components/partner/finances/PartnerFinancesOverviewTab.jsx')
    assert.match(overview, /PartnerSectionDivider/)
    assert.match(overview, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(overview, /finances-balance/)
    assert.match(overview, /finances-withdraw/)
    assert.match(overview, /partnerFinances_sectionBalance/)
    assert.match(overview, /partnerFinances_sectionWithdraw/)
    assert.match(overview, /PartnerFinancesBalanceStrip/)
    assert.match(overview, /PartnerFinancesPayoutMathCard/)
  })

  it('BalanceStrip + payout math/stat cards use hub list surface', () => {
    const strip = read('components/partner/finances/PartnerFinancesBalanceStrip.jsx')
    const math = read('components/partner/finances/PartnerFinancesPayoutMathCard.jsx')
    const stat = read('components/partner/finances/PartnerFinancesStatCard.jsx')
    assert.match(strip, /MOBILE_FLAT_CARD_CLASS/)
    assert.match(strip, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(math, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(stat, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.doesNotMatch(strip, /border-slate-500/)
    assert.doesNotMatch(strip, /border-\[#/)
  })

  it('LedgerTab wraps ledger / transactions with section titles', () => {
    const ledgerTab = read('components/partner/finances/PartnerFinancesLedgerTab.jsx')
    const history = read('components/partner/finances/PartnerFinancesTransactionHistory.jsx')
    assert.match(ledgerTab, /PartnerSectionDivider/)
    assert.match(ledgerTab, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(ledgerTab, /finances-transactions/)
    assert.match(ledgerTab, /partnerFinances_sectionTransactions/)
    assert.match(history, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
  })

  it('payout-profiles page uses section rhythm + hub surface (no API path change)', () => {
    const page = read('app/(partner)/partner/payout-profiles/page.js')
    assert.match(page, /PartnerSectionDivider/)
    assert.match(page, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(page, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(page, /payout-profiles-settings/)
    assert.match(page, /payout-profiles-requisites/)
    assert.match(page, /payoutProfiles_sectionWithdrawSettings/)
    assert.match(page, /payoutProfiles_sectionRequisites/)
    assert.match(page, /\/api\/v2\/partner\/payout-profiles/)
    assert.doesNotMatch(page, /border-slate-500/)
    assert.doesNotMatch(page, /border-\[#/)
  })

  it('section i18n keys exist for ru/en', () => {
    const finances = read('lib/translations/slices/partner-finances.js')
    const ui = read('lib/translations/slices/partner-ui.js')
    for (const key of [
      'partnerFinances_sectionBalance',
      'partnerFinances_sectionWithdraw',
      'partnerFinances_sectionTransactions',
      'partnerFinances_sectionReports',
    ]) {
      assert.ok(finances.includes(`${key}:`), `missing ${key}`)
    }
    for (const key of ['payoutProfiles_sectionWithdrawSettings', 'payoutProfiles_sectionRequisites']) {
      assert.ok(ui.includes(`${key}:`), `missing ${key}`)
    }
  })
})
