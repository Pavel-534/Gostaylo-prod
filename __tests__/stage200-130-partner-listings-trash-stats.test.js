/**
 * Stage 200.130 — partner listings: trash vs live stats + filter chip scroll.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-130-partner-listings-trash-stats.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.130 — partner listings trash stats + filter focus', () => {
  it('page keeps active query for stats and separate deleted query in trash', () => {
    const src = read('app/(partner)/partner/listings/page.js')
    assert.match(src, /filter: null/)
    assert.match(src, /filter: 'deleted'/)
    assert.match(src, /activeListings/)
    assert.match(src, /deletedListings/)
    assert.match(src, /countConciergeDraftListings\(activeListings\)/)
    assert.match(src, /total: activeListings\.length/)
    assert.doesNotMatch(src, /filter: trashMode \? 'deleted' : null/)
  })

  it('resume drafts banner is hidden in trash (deleted filter)', () => {
    const src = read('app/(partner)/partner/listings/page.js')
    assert.match(src, /listFilter !== 'deleted'/)
    assert.match(src, /resume-drafts-banner-btn/)
  })

  it('active filter chip scrolls into view on listFilter change', () => {
    const src = read('app/(partner)/partner/listings/page.js')
    assert.match(src, /filterTabRefs/)
    assert.match(src, /scrollIntoView/)
    assert.match(src, /inline: 'center'/)
    assert.match(src, /partner-listings-filter-tabs/)
    assert.match(src, /partner-listings-filter-\$\{tab\.id\}/)
  })
})
