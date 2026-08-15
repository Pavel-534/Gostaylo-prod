/**
 * Stage 201.48 — overlay bottom pad / keyboard pin / calendar hug.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-48-overlay-bottom-pad.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.48 — overlay bottom offsets', () => {
  it('calendar action modals hug (action), not form-fill', () => {
    const src = read('components/calendar/ActionModals.jsx')
    assert.match(src, /fit="action"/)
    assert.doesNotMatch(src, /fit="form"/)
  })

  it('BookingModal mobile uses Sheet form, not Vaul Drawer', () => {
    const src = read('components/listing/BookingModal.jsx')
    assert.match(src, /fit="form"/)
    assert.match(src, /SheetContent/)
    assert.doesNotMatch(src, /components\/ui\/drawer/)
    assert.doesNotMatch(src, /DrawerContent/)
  })

  it('seasonal dialog footer does not double safe-area pad', () => {
    const src = read('components/seasonal-price-manager.js')
    assert.doesNotMatch(
      src,
      /pb-\[max\(0\.75rem,env\(safe-area-inset-bottom\)\)\]/,
    )
  })

  it('form keyboard pin uses top+bottom without safe pad', () => {
    const { buildVisualViewportPinStyle } = require('../hooks/use-visual-viewport-frame.js')
    const pin = buildVisualViewportPinStyle(
      { heightPx: 420, offsetTop: 8, offsetLeft: 0, widthPx: 390, bottomInset: 300 },
      { recipe: 'form' },
    )
    assert.equal(pin.top, '8px')
    assert.equal(pin.bottom, '300px')
    assert.equal(pin.paddingBottom, '0px')
  })
})
