/**
 * Stage 201.40 — PDP soft-back in AppHeader; favorite FAB (no page-local ArrowLeft bar).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-40-pdp-soft-back-favorite-fab.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.40 — PDP soft-back + favorite FAB', () => {
  it('storefront soft-back enables listing PDP only', () => {
    const { resolveStorefrontSoftBack } = require('../lib/navigation/soft-back-routes.js')
    assert.equal(resolveStorefrontSoftBack('/listings').showSoftBack, false)
    assert.deepEqual(resolveStorefrontSoftBack('/listings/abc'), {
      showSoftBack: true,
      softBackFallback: '/listings',
    })
  })

  it('ListingPageNav is favorite FAB without ArrowLeft; PDP drops useSoftBack', () => {
    const nav = read('app/(storefront)/listings/[id]/components/ListingPageNav.jsx')
    assert.match(nav, /listing-pdp-favorite-fab/)
    assert.match(nav, /Heart/)
    assert.doesNotMatch(nav, /ArrowLeft/)
    assert.doesNotMatch(nav, /onBack/)

    const pdp = read('app/(storefront)/listings/[id]/ListingPdpClient.jsx')
    assert.doesNotMatch(pdp, /useSoftBack/)
    assert.doesNotMatch(pdp, /onBack=/)
  })
})
