/**
 * Stage 200.104 — Partner dashboard section rhythm SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-104-partner-dashboard-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.104 — partner dashboard rhythm', () => {
  it('PageContent uses section titles, dividers, hub surface on metric cards', () => {
    const page = read('components/partner/dashboard/PartnerDashboardPageContent.jsx')
    assert.match(page, /PartnerSectionDivider/)
    assert.match(page, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(page, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(page, /dashboard-alerts/)
    assert.match(page, /dashboard-quick-actions/)
    assert.match(page, /dashboard-metrics/)
    assert.match(page, /dashboard-upcoming/)
    assert.match(page, /usePartnerDashboardPage/)
    assert.doesNotMatch(page, /border-slate-500/)
    assert.doesNotMatch(page, /border-\[#/)
  })

  it('MoneyCard and PendingFlow adopt hub list surface', () => {
    const money = read('components/partner/dashboard/PartnerDashboardMoneyCard.jsx')
    const pending = read('components/partner/dashboard/PartnerDashboardPendingFlow.jsx')
    assert.match(money, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(money, /usePartnerDashboardMoney/)
    assert.match(pending, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(pending, /usePartnerDashboardBookingActions/)
  })

  it('section i18n keys exist for ru/en', () => {
    const i18n = read('lib/translations/slices/partner-shell.js')
    for (const key of [
      'partnerDashboard_sectionQuickActions',
      'partnerDashboard_sectionMetrics',
      'partnerDashboard_sectionAlerts',
      'partnerDashboard_sectionUpcoming',
    ]) {
      assert.ok(i18n.includes(`${key}:`), `missing ${key}`)
    }
  })
})
