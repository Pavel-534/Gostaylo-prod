/**
 * ADR-201 / Stage 201.44 — Mobile Chrome Contract (action | form | dialog).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-44-mobile-chrome-contract.test.js
 */

const { describe, it, beforeEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.44 — Mobile Chrome Contract (ADR-201)', () => {
  beforeEach(() => {
    const { __resetMobileDockLockForTests } = require('../lib/layout/mobile-dock-lock.js')
    __resetMobileDockLockForTests()
  })

  it('sheetFitToRecipe maps action/form and legacy aliases', () => {
    const { sheetFitToRecipe, dialogAnchorToRecipe } = require('../lib/layout/mobile-chrome-contract.js')
    assert.equal(sheetFitToRecipe('action'), 'action')
    assert.equal(sheetFitToRecipe('content'), 'action')
    assert.equal(sheetFitToRecipe('form'), 'form')
    assert.equal(sheetFitToRecipe('viewport'), 'form')
    assert.equal(dialogAnchorToRecipe('bottom'), 'form')
    assert.equal(dialogAnchorToRecipe('top'), 'dialog')
  })

  it('action pin: bottom 0, safe-area pad, never nav-height floor', () => {
    const {
      buildVisualViewportPinStyle,
      KEYBOARD_VIEWPORT_SHRINK_PX,
      MOBILE_CHROME_SAFE_PAD_BOTTOM,
    } = require('../hooks/use-visual-viewport-frame.js')

    const action = buildVisualViewportPinStyle(
      { heightPx: 700, offsetTop: 0, offsetLeft: 0, widthPx: 390, bottomInset: 0 },
      { recipe: 'action' },
    )
    assert.equal(action.bottom, '0px')
    assert.equal(action.height, 'auto')
    assert.equal(action.paddingBottom, MOBILE_CHROME_SAFE_PAD_BOTTOM)
    assert.doesNotMatch(String(action.paddingBottom), /app-bottom-nav/)

    const chromeOnly = buildVisualViewportPinStyle(
      { heightPx: 640, offsetTop: 0, offsetLeft: 0, widthPx: 390, bottomInset: 48 },
      { recipe: 'action' },
    )
    assert.ok(48 < KEYBOARD_VIEWPORT_SHRINK_PX)
    assert.equal(chromeOnly.bottom, '0px')

    const keyboard = buildVisualViewportPinStyle(
      { heightPx: 400, offsetTop: 0, offsetLeft: 0, widthPx: 390, bottomInset: 280 },
      { recipe: 'action' },
    )
    assert.equal(keyboard.bottom, '280px')
  })

  it('form pin fills visualViewport; dialog caps maxHeight', () => {
    const { buildVisualViewportPinStyle } = require('../hooks/use-visual-viewport-frame.js')
    const form = buildVisualViewportPinStyle(
      { heightPx: 700, offsetTop: 12, offsetLeft: 0, widthPx: 390, bottomInset: 0 },
      { recipe: 'form' },
    )
    assert.equal(form.top, '12px')
    assert.equal(form.height, '700px')

    const dialog = buildVisualViewportPinStyle(
      { heightPx: 700, offsetTop: 12, offsetLeft: 0, widthPx: 390, bottomInset: 0 },
      { recipe: 'dialog' },
    )
    assert.match(dialog.top, /12px/)
    assert.match(dialog.maxHeight, /700px/)
  })

  it('legacy mode aliases still resolve', () => {
    const { buildVisualViewportPinStyle } = require('../hooks/use-visual-viewport-frame.js')
    const hug = buildVisualViewportPinStyle(
      { heightPx: 500, offsetTop: 0, offsetLeft: 0, widthPx: 390, bottomInset: 0 },
      { mode: 'hug' },
    )
    assert.equal(hug.bottom, '0px')
    const fill = buildVisualViewportPinStyle(
      { heightPx: 500, offsetTop: 8, offsetLeft: 0, widthPx: 390, bottomInset: 0 },
      { mode: 'fill' },
    )
    assert.equal(fill.top, '8px')
  })

  it('dock lock refcount acquires and releases', () => {
    const {
      acquireMobileDockLock,
      getMobileDockLockCount,
      isMobileDockLocked,
    } = require('../lib/layout/mobile-dock-lock.js')
    assert.equal(getMobileDockLockCount(), 0)
    const release = acquireMobileDockLock()
    assert.equal(getMobileDockLockCount(), 1)
    assert.equal(isMobileDockLocked(), true)
    release()
    assert.equal(getMobileDockLockCount(), 0)
  })

  it('Sheet / Dialog / Search / docks wire ADR-201', () => {
    const sheet = read('components/ui/sheet.jsx')
    assert.match(sheet, /sheetFitToRecipe/)
    assert.match(sheet, /useMobileDockLock/)
    assert.match(sheet, /fit = "action"/)

    const dialog = read('components/ui/dialog.jsx')
    assert.match(dialog, /dialogAnchorToRecipe/)
    assert.match(dialog, /useMobileDockLock/)

    const search = read('components/search/CatalogMobileSearchSheet.jsx')
    assert.match(search, /MOBILE_CHROME_RECIPES\.FORM/)
    assert.match(search, /useMobileDockLock\(open\)/)

    assert.match(read('components/mobile-bottom-nav.jsx'), /useMobileDockLocked/)
    assert.match(read('components/partner/PartnerMobileBottomNav.jsx'), /useMobileDockLocked/)

    assert.match(read('components/calendar/calendar-action-overlay.jsx'), /fit=\{fit\}/)
    assert.match(read('components/calendar/ActionModals.jsx'), /fit="form"/)
    assert.match(read('components/partner-chat-calendar-peek.jsx'), /fit=\{isMobile \? 'form'/)
  })

  it('ADR-201 doc exists', () => {
    assert.match(read('docs/ADR/201-mobile-chrome-contract.md'), /Three recipes only/)
  })
})
