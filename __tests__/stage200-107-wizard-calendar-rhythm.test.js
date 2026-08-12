/**
 * Stage 200.107 — Wizard Calendar step section rhythm SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-107-wizard-calendar-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.107 — wizard calendar section rhythm', () => {
  it('StepCalendarSection uses PARTNER_SECTION titles + dividers for sync/blocks/seasons', () => {
    const section = read('app/(partner)/partner/listings/new/components/StepCalendarSection.jsx')
    assert.match(section, /PartnerSectionDivider/)
    assert.match(section, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(section, /calendar-sync/)
    assert.match(section, /calendar-blocks/)
    assert.match(section, /calendar-seasons/)
    assert.match(section, /wizardSection_calendarSync/)
    assert.match(section, /wizardSection_calendarBlocks/)
    assert.match(section, /wizardSection_calendarSeasons/)
    assert.match(section, /embedInPartnerSection/)
    assert.match(section, /AvailabilityCalendar/)
    assert.match(section, /SeasonalPriceManager/)
    assert.match(section, /CalendarSyncManager/)
  })

  it('StepCalendar keeps ensureCalendarListingReady; compact page subtitle', () => {
    const step = read('app/(partner)/partner/listings/new/components/StepCalendar.jsx')
    assert.match(step, /ensureCalendarListingReady/)
    assert.match(step, /WIZARD_STEP_TITLE_CLASS/)
    assert.match(step, /text-xs leading-relaxed text-slate-500/)
    assert.doesNotMatch(step, /WIZARD_STEP_SUBTITLE_CLASS/)
  })

  it('widgets accept embedInPartnerSection without changing fetch paths', () => {
    const sync = read('components/calendar-sync-manager.jsx')
    const seasonal = read('components/seasonal-price-manager.js')
    const avail = read('components/availability-calendar.jsx')
    assert.match(sync, /embedInPartnerSection/)
    assert.match(seasonal, /embedInPartnerSection/)
    assert.match(avail, /embedInPartnerSection/)
    assert.match(sync, /fetchIcalExportLink|postIcalSync/)
    assert.match(avail, /fetchListingCalendarBlocks/)
  })

  it('section i18n keys exist for ru/en', () => {
    const i18n = read('lib/translations/listings-partner-wizard.js')
    for (const key of [
      'wizardSection_calendarSync',
      'wizardSection_calendarBlocks',
      'wizardSection_calendarSeasons',
      'wizardSection_calendarSyncHint',
      'wizardSection_calendarBlocksHint',
      'wizardSection_calendarSeasonsHint',
    ]) {
      assert.ok(i18n.includes(`${key}:`), `missing ${key}`)
    }
  })
})
