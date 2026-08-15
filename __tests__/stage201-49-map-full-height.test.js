/**
 * Stage 201.49 — full-height catalog map + booking confirm hug.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-49-map-full-height.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.49 — map full height + booking hug', () => {
  it('CatalogMobileMapSheet fills header→bottom and locks dock', () => {
    const src = read('components/search/CatalogMobileMapSheet.jsx')
    assert.match(src, /useMobileDockLock\(open\)/)
    assert.match(src, /bottom-0/)
    assert.match(src, /--app-header-height/)
    assert.doesNotMatch(src, /app-fixed-above-bottom-nav/)
  })

  it('BookingModal mobile uses action hug, not form-fill', () => {
    const src = read('components/listing/BookingModal.jsx')
    assert.match(src, /fit="form"/)
  })
})
