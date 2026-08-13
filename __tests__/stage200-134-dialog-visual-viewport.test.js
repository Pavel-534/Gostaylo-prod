/**
 * Stage 200.134 — Dialog visualViewport pin + seasonal bottom sheet (no iOS keyboard black gap).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-134-dialog-visual-viewport.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.134 — dialog visualViewport + seasonal sheet', () => {
  it('exports useVisualViewportFrame with offsetTop + bottomInset', () => {
    const src = read('hooks/use-visual-viewport-frame.js')
    assert.match(src, /export function useVisualViewportFrame/)
    assert.match(src, /offsetTop/)
    assert.match(src, /bottomInset/)
    assert.match(src, /visualViewport/)
    assert.match(src, /addEventListener\('scroll'/)
  })

  it('DialogContent pins to visualViewport and supports mobileAnchor=bottom', () => {
    const src = read('components/ui/dialog.jsx')
    assert.match(src, /useVisualViewportFrame/)
    assert.match(src, /mobileAnchor/)
    assert.match(src, /buildVisualViewportPinStyle/)
    assert.match(src, /classHintsBottom/)
  })

  it('seasonal price manager uses bottom sheet (no fixed 100vh height)', () => {
    const src = read('components/seasonal-price-manager.js')
    assert.match(src, /mobileAnchor="bottom"/)
    assert.doesNotMatch(src, /h-\[min\(92dvh,calc\(100vh/)
    assert.match(src, /safe-area-inset-bottom/)
    assert.match(src, /min-h-\[44px\]/)
  })

  it('review modal uses mobileAnchor=bottom', () => {
    const src = read('components/review-modal.jsx')
    assert.match(src, /mobileAnchor="bottom"/)
  })
})
