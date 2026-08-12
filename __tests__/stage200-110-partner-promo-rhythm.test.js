/**
 * Stage 200.110 — Partner promo page section rhythm SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-110-partner-promo-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.110 — partner promo rhythm', () => {
  it('promo page uses section titles, divider, hub surface; keeps promo API paths', () => {
    const page = read('app/(partner)/partner/promo/page.js')
    assert.match(page, /PartnerSectionDivider/)
    assert.match(page, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(page, /PARTNER_FIELD_LABEL_CLASS/)
    assert.match(page, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(page, /promo-create/)
    assert.match(page, /promo-list/)
    assert.match(page, /handleSubmit/)
    assert.match(page, /\/api\/v2\/partner\/promo-codes/)
    assert.match(page, /min-h-\[44px\]/)
    assert.doesNotMatch(page, /border-slate-500/)
    assert.doesNotMatch(page, /border-\[#/)
  })

  it('section i18n keys exist for ru/en', () => {
    const i18n = read('lib/translations/slices/partner-shell.js')
    for (const key of [
      'partnerPromo_sectionCreate',
      'partnerPromo_sectionList',
      'partnerPromo_sectionFlash',
      'partnerPromo_listDesc',
      'partnerPromo_emptyCodes',
    ]) {
      assert.ok(i18n.includes(`${key}:`), `missing ${key}`)
    }
  })
})
