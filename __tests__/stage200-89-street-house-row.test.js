/**
 * Stage 200.89 — street+house one row; street search without house needle.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-89-street-house-row.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.89 — street/house row + search needle', () => {
  it('keeps street+house side-by-side on mobile (not flex-col)', () => {
    const src = read('app/(partner)/partner/listings/new/components/WizardStreetTypeahead.jsx')
    assert.doesNotMatch(src, /flex-col gap-3 sm:flex-row/)
    assert.match(src, /relative flex items-start gap-2/)
    assert.match(src, /wizard-house-input/)
    assert.match(src, /w-\[4\.75rem\]/)
  })

  it('street typing searches without house; house uses includeHouse', () => {
    const src = read('app/(partner)/partner/listings/new/components/WizardStreetTypeahead.jsx')
    assert.match(src, /includeHouse:\s*false/)
    assert.match(src, /includeHouse:\s*true/)
    assert.match(src, /Nominatim often returns nothing/)
  })

  it('places pin on house blur and always shows locate CTA when street ready', () => {
    const src = read('app/(partner)/partner/listings/new/components/WizardStreetTypeahead.jsx')
    assert.match(src, /onBlur=\{/)
    assert.match(src, /placeTopOrSearch/)
    assert.match(src, /canLocate \? \(/)
    assert.doesNotMatch(src, /canLocate && showList/)
  })
})
