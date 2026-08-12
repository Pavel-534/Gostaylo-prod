/**
 * Stage 200.116 Wave A — partner calendar picker hotfixes.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-116-partner-calendar-picker-hotfix.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.116 — partner calendar picker Wave A hotfix', () => {
  it('normalizeSeasonType maps mixed-case / unknown to Select-safe enum', () => {
    const {
      normalizeSeasonType,
      SEASON_TYPE_VALUES,
    } = require('../lib/listing/listing-seasonal-price-canon.js')
    assert.deepEqual(SEASON_TYPE_VALUES, ['LOW', 'NORMAL', 'HIGH', 'PEAK'])
    assert.equal(normalizeSeasonType('high'), 'HIGH')
    assert.equal(normalizeSeasonType('NORMAL'), 'NORMAL')
    assert.equal(normalizeSeasonType('low'), 'LOW')
    assert.equal(normalizeSeasonType('peak'), 'PEAK')
    assert.equal(normalizeSeasonType('BASE'), 'NORMAL')
    assert.equal(normalizeSeasonType(''), 'NORMAL')
    assert.equal(normalizeSeasonType(null), 'NORMAL')
  })

  it('seasonal modal SelectContent uses overlay-safe z-[400]', () => {
    const src = read('components/seasonal-price-manager.js')
    assert.match(src, /SelectContent className="z-\[400]"/)
    assert.match(src, /normalizeSeasonType/)
    assert.match(src, /seasonal-season-type-trigger/)
  })

  it('wizard load normalizes seasonType (no lowercase high default)', () => {
    const src = read('app/(partner)/partner/listings/new/hooks/listing-wizard-load-existing.js')
    assert.match(src, /normalizeSeasonType/)
    assert.doesNotMatch(src, /\|\| 'high'/)
  })

  it('master calendar price modal includes NORMAL season option', () => {
    const src = read('components/calendar/ActionModals.jsx')
    assert.match(src, /SelectItem value="NORMAL"/)
    assert.match(src, /partnerCal_seasonNormal/)
    const i18n = read('lib/translations/partner-calendar-modals.js')
    assert.match(i18n, /partnerCal_seasonNormal:/)
  })

  it('AvailabilityCalendar uses PartnerDateRangeFields SSOT (Wave B) with block testids', () => {
    const src = read('components/availability-calendar.jsx')
    assert.match(src, /PartnerDateRangeFields/)
    assert.match(src, /availability-block-start-trigger/)
    assert.match(src, /availability-block-end-trigger/)
    assert.doesNotMatch(src, /from '@\/components\/ui\/calendar'/)
  })

  it('does not change discovery / iCal sync API contracts in Wave A files', () => {
    const avail = read('components/availability-calendar.jsx')
    const seasonal = read('components/seasonal-price-manager.js')
    assert.match(avail, /postListingCalendarBlock/)
    assert.match(seasonal, /createSeasonalPrice|replaceSeasonalPrice/)
    assert.doesNotMatch(avail, /PARTNER_HUB_LIST_CARD/)
  })
})
