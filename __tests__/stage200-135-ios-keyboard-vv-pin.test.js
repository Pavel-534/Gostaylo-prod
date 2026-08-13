/**
 * Stage 200.135 — iOS keyboard: pin overlays to visualViewport rect (not bottomInset).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-135-ios-keyboard-vv-pin.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.135 — iOS keyboard visualViewport pin SSOT', () => {
  it('buildVisualViewportPinStyle fills vv with top+height (not bottom-only)', () => {
    const { buildVisualViewportPinStyle, KEYBOARD_VIEWPORT_SHRINK_PX } = require('../hooks/use-visual-viewport-frame.js')
    assert.equal(KEYBOARD_VIEWPORT_SHRINK_PX, 120)

    const withOffset = buildVisualViewportPinStyle(
      { heightPx: 400, offsetTop: 120, bottomInset: 280 },
      { mode: 'fill' },
    )
    assert.equal(withOffset.top, '120px')
    assert.equal(withOffset.bottom, 'auto')
    assert.equal(withOffset.height, '400px')
    assert.equal(withOffset.maxHeight, '400px')

    const maxMode = buildVisualViewportPinStyle(
      { heightPx: 500, offsetTop: 0, bottomInset: 0 },
      { mode: 'max' },
    )
    assert.match(String(maxMode.top), /0\.5rem|0px/)
    assert.equal(maxMode.bottom, 'auto')
    assert.ok(maxMode.maxHeight)
  })

  it('hook listens to focusin/focusout (number pad vs text)', () => {
    const src = read('hooks/use-visual-viewport-frame.js')
    assert.match(src, /focusin/)
    assert.match(src, /focusout/)
    assert.match(src, /buildVisualViewportPinStyle/)
    assert.match(src, /Do \*\*not\*\* rely on/)
  })

  it('DialogContent uses fill pin + scrollIntoView on focus', () => {
    const src = read('components/ui/dialog.jsx')
    assert.match(src, /buildVisualViewportPinStyle/)
    assert.match(src, /mode: anchor === 'bottom' \? 'fill' : 'max'/)
    assert.match(src, /scrollIntoView/)
    assert.match(src, /respectAppBottomNav: true/)
  })

  it('Sheet bottom side uses fill pin; calendar overlay drops !bottom fight', () => {
    const sheet = read('components/ui/sheet.jsx')
    assert.match(sheet, /buildVisualViewportPinStyle/)
    assert.match(sheet, /side === 'bottom'/)

    const cal = read('components/calendar/calendar-action-overlay.jsx')
    assert.doesNotMatch(cal, /!bottom-\[/)
  })

  it('key form dialogs opt into mobileAnchor=bottom', () => {
    const files = [
      'components/seasonal-price-manager.js',
      'components/review-modal.jsx',
      'components/partner/finances/PartnerFinancesWithdrawDialog.jsx',
      'components/support-request-dialog.jsx',
      'components/partner/HostVerificationLightModal.jsx',
      'components/renter/cancel-booking-dialog.jsx',
      'components/chat-invoice.jsx',
    ]
    for (const rel of files) {
      assert.match(read(rel), /mobileAnchor="bottom"/, rel)
    }
  })
})
