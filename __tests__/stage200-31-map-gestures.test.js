/**
 * Stage 200.31 — MapPicker pan/zoom vs pin-lock + Leaflet gesture sync.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-31-map-gestures.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.31 — map gestures', () => {
  it('MapPicker separates view gestures from pin edit (no dragging&&mapClicksEnabled)', () => {
    const src = read('components/listing/MapPicker.jsx')
    assert.match(src, /MapGestureSync/)
    assert.match(src, /viewGesturesEnabled/)
    assert.match(src, /pinEditEnabled/)
    assert.doesNotMatch(src, /dragging=\{mapGesturesEnabled && mapClicksEnabled\}/)
    assert.match(src, /cooperativeTouch === 'auto'/)
  })

  it('MapGestureSync enables/disables live Leaflet handlers', () => {
    const src = read('components/listing/MapGestureSync.jsx')
    assert.match(src, /h\.enable\(\)/)
    assert.match(src, /h\.disable\(\)/)
    assert.match(src, /touchZoom/)
    assert.match(src, /dragging/)
  })

  it('ListingMap also syncs gestures after cooperative tap', () => {
    const src = read('components/listing/ListingMap.jsx')
    assert.match(src, /MapGestureSync/)
  })

  it('locked hint copy allows pan/zoom', () => {
    const src = read('lib/translations/listings-public.js')
    assert.match(src, /mapPicker_hintLocked:.*"Карту можно двигать/)
  })
})
