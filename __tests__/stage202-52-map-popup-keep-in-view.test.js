/**
 * Stage 202.52 — catalog map popup keep-in-view (soft pan, no zoom jerk).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-52-map-popup-keep-in-view.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { computeLeafletPopupKeepInViewPanBy } from '../lib/maps/map-popup-keep-in-view.js'
import {
  CATALOG_MAP_POPUP_AUTOPAN_PADDING_XY,
  CATALOG_MAP_POPUP_PAD_DESKTOP,
  CATALOG_MAP_POPUP_PAD_MOBILE,
} from '../lib/maps/catalog-map-ux-policy.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.52 — map popup keep-in-view math', () => {
  it('pans down when popup is clipped at the top (desktop case)', () => {
    const { x, y } = computeLeafletPopupKeepInViewPanBy({
      mapWidth: 400,
      mapHeight: 500,
      popupLeft: 100,
      popupTop: -80,
      popupWidth: 220,
      popupHeight: 260,
      padding: CATALOG_MAP_POPUP_PAD_DESKTOP,
      minPanPx: 8,
    })
    assert.equal(x, 0)
    // top overflow → negative dy (Leaflet convention)
    assert.ok(y < 0)
  })

  it('pans when clipped on the right', () => {
    const { x, y } = computeLeafletPopupKeepInViewPanBy({
      mapWidth: 400,
      mapHeight: 500,
      popupLeft: 300,
      popupTop: 100,
      popupWidth: 220,
      popupHeight: 200,
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
      minPanPx: 8,
    })
    assert.ok(x > 0)
    assert.equal(y, 0)
  })

  it('no-ops when popup already fits with padding', () => {
    const delta = computeLeafletPopupKeepInViewPanBy({
      mapWidth: 800,
      mapHeight: 600,
      popupLeft: 200,
      popupTop: 120,
      popupWidth: 220,
      popupHeight: 260,
      padding: CATALOG_MAP_POPUP_PAD_DESKTOP,
      minPanPx: 8,
    })
    assert.deepEqual(delta, { x: 0, y: 0 })
  })

  it('ignores micro pans under minPanPx', () => {
    const delta = computeLeafletPopupKeepInViewPanBy({
      mapWidth: 400,
      mapHeight: 500,
      popupLeft: 36,
      popupTop: 100,
      popupWidth: 100,
      popupHeight: 100,
      padding: { top: 40, right: 40, bottom: 40, left: 40 },
      minPanPx: 8,
    })
    // left overflow = 36-40 = -4 → below min → 0
    assert.deepEqual(delta, { x: 0, y: 0 })
  })

  it('mobile pad reserves space for bottom rail', () => {
    assert.ok(CATALOG_MAP_POPUP_PAD_MOBILE.bottom > CATALOG_MAP_POPUP_PAD_DESKTOP.bottom)
    assert.equal(CATALOG_MAP_POPUP_AUTOPAN_PADDING_XY.length, 2)
  })
})

describe('Stage 202.52 — CatalogMapSelectedPopup wiring', () => {
  it('enables Leaflet autoPan and soft keep-in-view helper', () => {
    const src = read('components/listing/CatalogMapSelectedPopup.jsx')
    assert.match(src, /autoPan/)
    assert.match(src, /computeLeafletPopupKeepInViewPanBy|panMapToKeepListingPopupInView/)
    assert.match(src, /CATALOG_MAP_POPUP_KEEP_IN_VIEW_DURATION_S/)
    assert.match(src, /compactMapChrome/)
  })

  it('InteractiveSearchMap passes compactMapChrome for mobile highlight-only mode', () => {
    const src = read('components/listing/InteractiveSearchMap.jsx')
    assert.match(src, /compactMapChrome=\{selectionPanMode === CATALOG_MAP_SELECTION_PAN_HIGHLIGHT_ONLY\}/)
  })
})
