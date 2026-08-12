/**
 * Stage 200.117 Wave B — PartnerDateRangeFields SSOT for wizard blocks + seasons.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-117-partner-date-range-ssot.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.117 — PartnerDateRangeFields SSOT', () => {
  it('PartnerDateRangeFields uses ui/calendar + controlled popovers; autoOpenEnd opt-in only', () => {
    const src = read('components/partner/PartnerDateRangeFields.jsx')
    assert.match(src, /from '@\/components\/ui\/calendar'/)
    assert.match(src, /open=\{startOpen\}/)
    assert.match(src, /open=\{endOpen\}/)
    assert.match(src, /setStartOpen\(false\)/)
    assert.match(src, /autoOpenEnd = false/)
    assert.match(src, /if \(autoOpenEnd\) setEndOpen\(true\)/)
    assert.match(src, /setEndOpen\(false\)/)
    assert.match(src, /PARTNER_DATE_POPOVER_IN_OVERLAY_CLASS/)
    assert.match(src, /z-\[400\]/)
    assert.doesNotMatch(src, /react-day-picker\/dist\/style/)
  })

  it('AvailabilityCalendar and SeasonalPriceManager both use PartnerDateRangeFields', () => {
    const avail = read('components/availability-calendar.jsx')
    const seasonal = read('components/seasonal-price-manager.js')
    assert.match(avail, /PartnerDateRangeFields/)
    assert.match(seasonal, /PartnerDateRangeFields/)
    assert.match(seasonal, /PARTNER_DATE_POPOVER_IN_OVERLAY_CLASS/)
    assert.match(seasonal, /seasonal-date-start-trigger/)
  })

  it('Seasonal modal no longer mounts inline DayPicker or default rdp CSS', () => {
    const seasonal = read('components/seasonal-price-manager.js')
    assert.doesNotMatch(seasonal, /from 'react-day-picker'/)
    assert.doesNotMatch(seasonal, /react-day-picker\/dist\/style/)
    assert.doesNotMatch(seasonal, /<DayPicker/)
  })

  it('Seasonal modal field order: name/type before date range', () => {
    const seasonal = read('components/seasonal-price-manager.js')
    const nameIdx = seasonal.indexOf("t('seasonalMgr_seasonName')")
    const rangeIdx = seasonal.indexOf("t('seasonalMgr_selectRange')")
    const datesIdx = seasonal.indexOf('<PartnerDateRangeFields')
    assert.ok(nameIdx > 0 && rangeIdx > 0 && datesIdx > 0)
    assert.ok(nameIdx < rangeIdx, 'season name should appear before date range label')
    assert.ok(rangeIdx < datesIdx, 'date range label should appear before PartnerDateRangeFields')
  })

  it('i18n pick/start/end keys exist for ru/en', () => {
    const i18n = read('lib/translations/partner-calendar-modals.js')
    assert.match(i18n, /partnerCal_pickDate:/)
    assert.match(i18n, /partnerCal_dateStart:/)
    assert.match(i18n, /partnerCal_dateEnd:/)
  })

  it('resolvePartnerDateFnsLocale is shared SSOT', () => {
    const loc = read('lib/ui/partner-date-fns-locale.js')
    assert.match(loc, /export function resolvePartnerDateFnsLocale/)
    assert.match(loc, /PARTNER_DATE_FNS_LOCALES/)
  })
})
