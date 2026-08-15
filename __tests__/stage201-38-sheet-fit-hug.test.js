/**
 * Stage 201.38 / 201.39 — bottom Sheet hug-to-content (thumb zone) SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-38-sheet-fit-hug.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.38 / 201.39 — sheet fit hug SSOT', () => {
  it('buildVisualViewportPinStyle hug anchors bottom with auto height', () => {
    const { buildVisualViewportPinStyle } = require('../hooks/use-visual-viewport-frame.js')
    const hug = buildVisualViewportPinStyle(
      { heightPx: 700, offsetTop: 0, offsetLeft: 0, widthPx: 390, bottomInset: 0 },
      { mode: 'hug', respectAppBottomNav: false },
    )
    assert.equal(hug.top, 'auto')
    assert.equal(hug.height, 'auto')
    assert.equal(hug.bottom, '0px')
    assert.equal(hug.maxHeight, '700px')

    const fill = buildVisualViewportPinStyle(
      { heightPx: 700, offsetTop: 12, offsetLeft: 0, widthPx: 390, bottomInset: 0 },
      { mode: 'fill', respectAppBottomNav: false },
    )
    assert.equal(fill.top, '12px')
    assert.equal(fill.height, '700px')
  })

  it('hug ignores small iOS Safari chrome bottomInset (only keyboard lifts sheet)', () => {
    const { buildVisualViewportPinStyle, KEYBOARD_VIEWPORT_SHRINK_PX } = require(
      '../hooks/use-visual-viewport-frame.js',
    )
    const safariChrome = buildVisualViewportPinStyle(
      { heightPx: 640, offsetTop: 0, offsetLeft: 0, widthPx: 390, bottomInset: 48 },
      { mode: 'hug', respectAppBottomNav: false },
    )
    assert.ok(48 < KEYBOARD_VIEWPORT_SHRINK_PX)
    assert.equal(safariChrome.bottom, '0px')

    const keyboard = buildVisualViewportPinStyle(
      { heightPx: 400, offsetTop: 0, offsetLeft: 0, widthPx: 390, bottomInset: 280 },
      { mode: 'hug', respectAppBottomNav: false },
    )
    assert.equal(keyboard.bottom, '280px')
  })

  it('SheetContent defaults bottom to fit=content; peek uses viewport', () => {
    const sheet = read('components/ui/sheet.jsx')
    assert.match(sheet, /fit = "content"/)
    assert.match(sheet, /mode: pinMode/)
    assert.match(sheet, /hug/)

    assert.match(read('components/search/CatalogSortSelect.jsx'), /fit="content"/)
    assert.match(read('components/partner/listings/PartnerListingCardActions.jsx'), /fit="content"/)
    assert.match(read('components/calendar/calendar-action-overlay.jsx'), /fit="content"/)
    assert.match(
      read('app/(partner)/partner/listings/new/components/preview/ListingWizardPreviewSheet.jsx'),
      /fit="content"/,
    )
    assert.match(read('components/partner-chat-calendar-peek.jsx'), /fit=\{isMobile \? 'viewport' : undefined\}/)
  })

  it('CatalogMobileSearchSheet uses hug pin above bottom nav', () => {
    const src = read('components/search/CatalogMobileSearchSheet.jsx')
    assert.match(src, /buildVisualViewportPinStyle/)
    assert.match(src, /mode: 'hug'/)
    assert.match(src, /respectAppBottomNav: true/)
    assert.doesNotMatch(src, /className=\{?["'`][^"'`]*flex-1/)
    assert.doesNotMatch(src, /92dvh/)
  })

  it('action sheets do not double-count bottom nav in padding', () => {
    const listing = read('components/partner/listings/PartnerListingCardActions.jsx')
    assert.doesNotMatch(listing, /app-bottom-nav-height/)
    const calOpts = read('components/calendar/CalendarMobileQuickActions.jsx')
    assert.doesNotMatch(calOpts, /app-bottom-nav-height/)
  })
})
