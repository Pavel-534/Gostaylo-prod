/**
 * Stage 200.26 — moderation content update + wizard scroll-to-top on step change.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-26-admin-moderation-edit-wizard-scroll.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.26 — moderation PATCH update (title/desc/district/price)', () => {
  it('supports action update with content fields helper', () => {
    const src = read('app/api/admin/moderation/route.js')
    assert.match(src, /action === 'update'/)
    assert.match(src, /applyModerationContentFields/)
    assert.match(src, /base_price_thb/)
    assert.match(src, /update only allowed for PENDING/)
    assert.match(src, /basePriceThb/)
  })

  it('UI can save edits without approve', () => {
    const src = read('app/admin/moderation/page.js')
    assert.match(src, /action: 'update'/)
    assert.match(src, /handleSaveListingEdits/)
    assert.match(src, /draftDistrict/)
    assert.match(src, /draftPrice/)
    assert.match(src, /Сохранить правки/)
  })

  it('audit accepts update action', () => {
    const src = read('lib/services/audit/staff-audit.js')
    assert.match(src, /'update'/)
  })
})

describe('Stage 200.26 — wizard scroll to top on step change', () => {
  it('scrolls workspace scrollport when currentStep changes', () => {
    const src = read(
      'app/(partner)/partner/listings/new/components/ListingWizardPageInner.jsx',
    )
    assert.match(src, /findWorkspaceScrollRoot/)
    assert.match(src, /\[currentStep\]/)
    assert.match(src, /scrollTo\(\{\s*top:\s*0/)
  })
})
