/**
 * Stage 200.119 Wave D — wizard calendar OTA copy clarity.
 * Stage 200.120 Wave E — master calendar ActionModals → PartnerDateRangeFields.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-119-120-partner-calendar-copy-and-modals.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.119 — Wave D OTA copy', () => {
  it('wizard section titles avoid OTA jargon; name Airbnb/Booking', () => {
    const i18n = read('lib/translations/listings-partner-wizard.js')
    assert.match(i18n, /wizardSection_calendarSync: "Календари Airbnb и Booking"/)
    assert.match(i18n, /wizardSection_calendarSync: "Airbnb & Booking calendars"/)
    assert.match(i18n, /wizardSection_calendarSync: "Airbnb 与 Booking 日历"/)
    assert.match(i18n, /wizardSection_calendarSync: "ปฏิทิน Airbnb และ Booking"/)
    assert.doesNotMatch(i18n, /wizardSection_calendarSync: "Синхронизация OTA"/)
    assert.doesNotMatch(i18n, /wizardSection_calendarSync: "OTA sync"/)
    assert.doesNotMatch(i18n, /wizardStep_calendarHint:\s*"OTA /)
    assert.doesNotMatch(i18n, /wizardStep_calendarHint:\s*"Синхронизация с OTA/)
  })
})

describe('Stage 200.120 — Wave E master calendar date SSOT', () => {
  it('ActionModals uses PartnerDateRangeFields; no native type=date', () => {
    const src = read('components/calendar/ActionModals.jsx')
    assert.match(src, /PartnerDateRangeFields/)
    assert.match(src, /parsePartnerYmd/)
    assert.match(src, /formatPartnerYmd/)
    assert.match(src, /lockStart/)
    assert.match(src, /master-block-end/)
    assert.match(src, /master-booking-checkout/)
    assert.match(src, /master-price-start/)
    assert.doesNotMatch(src, /type="date"/)
    assert.doesNotMatch(src, /DATE_INPUT_CLASS/)
  })

  it('PartnerDateRangeFields supports lockStart; ymd helpers live in lib', () => {
    const ui = read('components/partner/PartnerDateRangeFields.jsx')
    const ymd = read('lib/ui/partner-date-ymd.js')
    assert.match(ui, /lockStart/)
    assert.match(ui, /from '@\/lib\/ui\/partner-date-ymd'/)
    assert.match(ymd, /export function parsePartnerYmd/)
    assert.match(ymd, /export function formatPartnerYmd/)
  })

  it('parsePartnerYmd / formatPartnerYmd round-trip', async () => {
    const { parsePartnerYmd, formatPartnerYmd } = await import('../lib/ui/partner-date-ymd.js')
    const d = parsePartnerYmd('2026-08-17')
    assert.ok(d instanceof Date)
    assert.equal(formatPartnerYmd(d), '2026-08-17')
    assert.equal(parsePartnerYmd(''), null)
    assert.equal(parsePartnerYmd(null), null)
  })
})
