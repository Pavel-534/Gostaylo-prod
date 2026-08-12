/**
 * Stage 200.106 — Partner settings section rhythm SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-106-partner-settings-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.106 — partner settings rhythm', () => {
  it('settings page uses section titles, dividers, field labels, hub surface', () => {
    const page = read('app/(partner)/partner/settings/page.js')
    assert.match(page, /PartnerSectionDivider/)
    assert.match(page, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(page, /PARTNER_FIELD_LABEL_CLASS/)
    assert.match(page, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(page, /MOBILE_FLAT_CARD_CLASS/)
    assert.match(page, /settings-profile/)
    assert.match(page, /settings-security/)
    assert.match(page, /settings-notifications/)
    assert.match(page, /settings-integrations/)
    assert.match(page, /partner-verification-panel/)
    assert.match(page, /handleSaveSettings/)
    assert.match(page, /\/api\/v2\/auth\/me/)
    assert.match(page, /\/api\/v2\/partner\/application-status/)
    assert.doesNotMatch(page, /border-slate-500/)
    assert.doesNotMatch(page, /border-\[#/)
  })

  it('section i18n keys exist for ru/en', () => {
    const i18n = read('lib/translations/slices/partner-shell.js')
    for (const key of [
      'partnerSettings_pageTitle',
      'partnerSettings_sectionProfile',
      'partnerSettings_sectionSecurity',
      'partnerSettings_sectionNotifications',
      'partnerSettings_sectionIntegrations',
      'partnerSettings_fieldAgency',
      'partnerSettings_fieldEmailHint',
    ]) {
      assert.ok(i18n.includes(`${key}:`), `missing ${key}`)
    }
  })
})
