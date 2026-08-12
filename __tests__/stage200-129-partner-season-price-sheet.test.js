/**
 * Stage 200.129 — seasonal price sheet fit + no chained end-date picker.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-129-partner-season-price-sheet.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.129 — partner season price sheet + date UX', () => {
  it('PartnerDateRangeFields defaults autoOpenEnd to false', () => {
    const src = read('components/partner/PartnerDateRangeFields.jsx')
    assert.match(src, /autoOpenEnd = false/)
    assert.match(src, /if \(autoOpenEnd\) setEndOpen\(true\)/)
  })

  it('master calendar price modal pins autoOpenEnd={false} and clamps overflow', () => {
    const src = read('components/calendar/ActionModals.jsx')
    assert.match(src, /master-price-start/)
    assert.match(src, /autoOpenEnd=\{false\}/)
    assert.match(src, /min-w-0/)
    assert.doesNotMatch(src, /🔧/)
  })

  it('CalendarActionOverlay mobile sheet uses min-w-0 + overflow-x-hidden + token borders', () => {
    const src = read('components/calendar/calendar-action-overlay.jsx')
    assert.match(src, /overflow-x-hidden/)
    assert.match(src, /min-w-0/)
    assert.match(src, /border-border/)
    assert.doesNotMatch(src, /border-slate-200/)
  })

  it('wizard seasonal + availability date ranges also disable auto-open end', () => {
    const seasonal = read('components/seasonal-price-manager.js')
    const avail = read('components/availability-calendar.jsx')
    assert.match(seasonal, /autoOpenEnd=\{false\}/)
    assert.match(avail, /autoOpenEnd=\{false\}/)
  })
})
