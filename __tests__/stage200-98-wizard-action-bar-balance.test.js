/**
 * Stage 200.98 — Wizard sticky action bar vertical balance.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-98-wizard-action-bar-balance.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.98 — wizard action bar vertical balance', () => {
  it('inner bar uses equal pt + additive safe-area pb (not .safe-area-pb)', () => {
    const layout = read(
      'app/(partner)/partner/listings/new/components/chrome/listing-wizard-layout.js',
    )
    assert.match(layout, /WIZARD_MOBILE_ACTION_BAR_INNER_CLASS/)
    assert.match(layout, /pt-3/)
    assert.match(layout, /pb-\[calc\(0\.75rem\+env\(safe-area-inset-bottom\)\)\]/)
    assert.match(layout, /WIZARD_MOBILE_ACTION_BAR_POSITION_CLASS/)

    const bar = read(
      'app/(partner)/partner/listings/new/components/chrome/ListingWizardMobileActionBar.jsx',
    )
    assert.match(bar, /WIZARD_MOBILE_ACTION_BAR_INNER_CLASS/)
    assert.doesNotMatch(bar, /className=\{?["'`][^"'`]*safe-area-pb/)
    assert.doesNotMatch(bar, /\bpy-3\b.*safe-area-pb|safe-area-pb.*\bpy-3\b/)
  })
})
