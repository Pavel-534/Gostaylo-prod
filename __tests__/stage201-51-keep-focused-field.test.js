/**
 * Stage 201.51 — keep focused field above soft keyboard.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-51-keep-focused-field.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.51 — keep focused field visible', () => {
  it('SSOT module exports ensure + schedule helpers', () => {
    const mod = require('../lib/layout/keep-focused-field-visible.js')
    assert.equal(typeof mod.ensureFocusedFieldVisible, 'function')
    assert.equal(typeof mod.scheduleEnsureFocusedFieldVisible, 'function')
    assert.equal(typeof mod.findVerticalScrollParent, 'function')
  })

  it('Sheet and Dialog wire useKeepFocusedFieldVisible', () => {
    assert.match(read('components/ui/sheet.jsx'), /useKeepFocusedFieldVisible/)
    assert.match(read('components/ui/dialog.jsx'), /useKeepFocusedFieldVisible/)
    assert.match(read('hooks/use-keep-focused-field-visible.js'), /document\.addEventListener\('focusin'/)
    assert.match(read('lib/layout/keep-focused-field-visible.js'), /data-mobile-overlay-scrollport/)
  })

  it('calendar editors use form + scrollable flex body', () => {
    const src = read('components/calendar/ActionModals.jsx')
    assert.match(src, /type === 'block' \|\| actionModal\.type === 'booking'/)
    assert.match(src, /\? 'form'/)
    assert.match(src, /: 'action'/)
    assert.match(
      read('components/calendar/calendar-action-overlay.jsx'),
      /fit === 'form' && 'min-h-0 flex-1'/,
    )
    assert.match(
      read('components/calendar/calendar-action-overlay.jsx'),
      /data-mobile-overlay-scrollport/,
    )
  })
})
