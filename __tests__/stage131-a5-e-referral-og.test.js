/**
 * Stage 131.A5.E — referral OG: mark1 + Airento word only.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a5-e-referral-og.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 131.A5.E — referral OG preview', () => {
  it('uses airento-mark1 and only brand word under the mark', () => {
    const src = read('app/(storefront)/u/[id]/opengraph-image.js')
    assert.match(src, /airento-mark1\.png/)
    assert.match(src, /getSiteDisplayName/)
    assert.doesNotMatch(src, /stage1322_ogInvite/)
    assert.doesNotMatch(src, /stage1322_ogSubtitle/)
    assert.doesNotMatch(src, /Partner/)
    assert.ok(fs.existsSync(path.join(root, 'public/brand/airento-mark1.png')))
  })

  it('metadata cache-busts og image URL', () => {
    assert.match(read('app/(storefront)/u/[id]/layout.js'), /opengraph-image\?v=20260821/)
    assert.match(read('app/(storefront)/go/[vanity]/layout.js'), /opengraph-image\?v=20260821/)
  })
})
