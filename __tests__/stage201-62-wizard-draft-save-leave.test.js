/**
 * Stage 201.62 — draft save upserts existing wizard row and leaves to listings list.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-62-wizard-draft-save-leave.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.62 — wizard draft save → listings (no orphan)', () => {
  it('saveDraft prefers existing draft id (edit or ref) over POST', () => {
    const src = read('app/(partner)/partner/listings/new/hooks/useListingSave.js')
    assert.match(src, /existingDraftId/)
    assert.match(src, /draftListingIdRef\?\.current/)
    assert.match(src, /leaveToPartnerListingsAfterDraftSave/)
    assert.match(src, /router\.push\('\/partner\/listings'\)/)
    assert.doesNotMatch(
      src,
      /router\.replace\(`\/partner\/listings\/new\?edit=/,
    )
  })

  it('category ensure keeps draft id in ref without forcing ?edit= wipe', () => {
    const actions = read('app/(partner)/partner/listings/new/hooks/useListingWizardActions.js')
    assert.match(actions, /updateUrl:\s*false/)
    assert.match(actions, /wipes in-progress form/)
  })
})
