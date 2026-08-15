/**
 * Stage 201.45 — soft-keyboard gate (do not hide dock on browser chrome inset alone).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-45-soft-keyboard-dock.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.45 — soft keyboard + dock visibility', () => {
  it('isSoftKeyboardOpen requires editable focus, not inset alone', () => {
    const { isSoftKeyboardOpen, isEditableFocusTarget } = require('../lib/layout/is-soft-keyboard-open.js')

    assert.equal(isEditableFocusTarget({ tagName: 'INPUT', type: 'text' }), true)
    assert.equal(isEditableFocusTarget({ tagName: 'INPUT', type: 'button' }), false)
    assert.equal(isEditableFocusTarget({ tagName: 'DIV' }), false)

    const vv = { offsetTop: 0, height: 500 }
    // Fake window for the helper
    const prev = global.window
    global.window = { innerHeight: 800 }
    try {
      assert.equal(
        isSoftKeyboardOpen(vv, { activeElement: { tagName: 'BODY' } }),
        false,
        'large inset without editable focus must not count as keyboard',
      )
      assert.equal(
        isSoftKeyboardOpen(vv, { activeElement: { tagName: 'INPUT', type: 'text' } }),
        true,
      )
      assert.equal(
        isSoftKeyboardOpen({ offsetTop: 0, height: 750 }, { activeElement: { tagName: 'INPUT', type: 'text' } }),
        false,
        'small inset is not keyboard',
      )
    } finally {
      global.window = prev
    }
  })

  it('guest and partner docks use isSoftKeyboardOpen', () => {
    assert.match(read('components/mobile-bottom-nav.jsx'), /isSoftKeyboardOpen/)
    assert.match(read('components/partner/PartnerMobileBottomNav.jsx'), /isSoftKeyboardOpen/)
    assert.doesNotMatch(read('components/mobile-bottom-nav.jsx'), /bottomInset > KEYBOARD/)
  })

  it('Dialog locks dock only on mobile matchMedia', () => {
    const src = read('components/ui/dialog.jsx')
    assert.match(src, /max-width: 767px/)
    assert.match(src, /useMobileDockLock\(lockDock\)/)
    assert.doesNotMatch(src, /useMobileDockLock\(true\)/)
  })

  it('calendar form sheet body flex-1 so footer sits on bottom', () => {
    const src = read('components/calendar/calendar-action-overlay.jsx')
    assert.match(src, /fit === 'form' && 'min-h-0 flex-1'/)
  })
})
