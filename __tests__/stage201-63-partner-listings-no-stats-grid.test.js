/**
 * Stage 201.63 — partner listings: drop KPI summary grid (list-first).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-63-partner-listings-no-stats-grid.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.63 — partner listings list-first (no summary grid)', () => {
  it('listings page has no Сводка KPI grid section', () => {
    const page = read('app/(partner)/partner/listings/page.js')
    assert.doesNotMatch(page, /listings-stats/)
    assert.doesNotMatch(page, /partnerListings_sectionStats/)
    assert.doesNotMatch(page, /partnerListings_statViews/)
    assert.match(page, /listings-list/)
    assert.match(page, /listing\.views/)
  })
})
