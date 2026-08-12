/**
 * Stage 200.109 — Global /partner/calendar section rhythm SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-109-partner-calendar-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.109 — partner calendar page rhythm', () => {
  it('calendar page uses section titles, dividers, hub surface; keeps mutate handlers', () => {
    const page = read('app/(partner)/partner/calendar/page.js')
    assert.match(page, /PartnerSectionDivider/)
    assert.match(page, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(page, /PARTNER_HUB_LIST_CARD_SURFACE_CLASS/)
    assert.match(page, /calendar-context/)
    assert.match(page, /calendar-controls/)
    assert.match(page, /calendar-board/)
    assert.match(page, /handleBlockSubmit/)
    assert.match(page, /handleBookingSubmit/)
    assert.match(page, /handleIcalSyncAll/)
    assert.match(page, /usePartnerCalendar/)
    assert.match(page, /ActionModals/)
    assert.doesNotMatch(page, /border-slate-500/)
    assert.doesNotMatch(page, /border-\[#/)
  })

  it('section i18n keys exist for ru/en', () => {
    const i18n = read('lib/translations/partner-calendar-modals.js')
    for (const key of [
      'partnerCal_sectionContext',
      'partnerCal_sectionControls',
      'partnerCal_sectionBoard',
    ]) {
      assert.ok(i18n.includes(`${key}:`), `missing ${key}`)
    }
  })
})
