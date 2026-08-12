/**
 * Stage 200.118 Wave C — AvailabilityCalendar full i18n.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-118-availability-calendar-i18n.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

const REQUIRED_KEYS = [
  'partnerAvail_syncErrorTitle',
  'partnerAvail_syncErrorBody',
  'partnerAvail_blockTitle',
  'partnerAvail_blockDesc',
  'partnerAvail_reasonLabel',
  'partnerAvail_reasonPh',
  'partnerAvail_defaultReason',
  'partnerAvail_daysWillBlock',
  'partnerAvail_manualTitle',
  'partnerAvail_manualDesc',
  'partnerAvail_manualEmpty',
  'partnerAvail_daysShort',
  'partnerAvail_icalTitle',
  'partnerAvail_icalDesc',
  'partnerAvail_moreRecords',
  'partnerAvail_genericError',
]

describe('Stage 200.118 — AvailabilityCalendar i18n (Wave C)', () => {
  it('AvailabilityCalendar has no hardcoded Russian UI strings', () => {
    const src = read('components/availability-calendar.jsx')
    assert.doesNotMatch(src, /Заблокировать даты/)
    assert.doesNotMatch(src, /Ручные блокировки/)
    assert.doesNotMatch(src, /Синхронизировано из iCal/)
    assert.doesNotMatch(src, /Нет ручных блокировок/)
    assert.doesNotMatch(src, /Даты заблокированы/)
    assert.doesNotMatch(src, /Ошибка синхронизации календаря/)
    assert.doesNotMatch(src, /Причина \(необязательно\)/)
    assert.match(src, /partnerAvail_blockTitle/)
    assert.match(src, /partnerCal_toast_blockSuccess/)
    assert.match(src, /partnerCal_toast_unblockSuccess/)
    assert.match(src, /getUIText/)
  })

  it('partnerAvail_* keys exist for ru/en/zh/th', () => {
    const i18n = read('lib/translations/partner-calendar-modals.js')
    for (const key of REQUIRED_KEYS) {
      const matches = i18n.match(new RegExp(`${key}:`, 'g'))
      assert.ok(matches && matches.length >= 4, `expected ${key} in 4 locales, got ${matches?.length || 0}`)
    }
  })

  it('keeps PartnerDateRangeFields + calendar block API clients', () => {
    const src = read('components/availability-calendar.jsx')
    assert.match(src, /PartnerDateRangeFields/)
    assert.match(src, /postListingCalendarBlock/)
    assert.match(src, /deleteListingCalendarBlock/)
    assert.match(src, /fetchListingCalendarBlocks/)
  })
})
