/**
 * Stage 201.64 — partial draft save (no geo/publish gates) + deferred server create.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-64-partial-draft-save.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.64 — partial draft save', () => {
  it('saveDraft uses permissive path for drafts (not savePatchForEdit geo gates)', () => {
    const src = read('app/(partner)/partner/listings/new/hooks/useListingSave.js')
    assert.match(src, /optionalDraftGeoFields/)
    assert.match(src, /isWizardServerDraft/)
    assert.match(src, /Never run provisional city/)
    assert.match(src, /partnerWizard_selectCategoryBeforePhotos/)
    // Published edit still patches; drafts do not early-return to savePatchForEdit alone
    assert.match(src, /!isWizardServerDraft\(serverListing, formData\)/)
  })

  it('PUT listing treats blank country as non-touch for geo assert', () => {
    const route = read('app/api/v2/partner/listings/[id]/route.js')
    assert.match(route, /nonEmptyGeo/)
    assert.match(route, /blank country\/city on partial draft/)
  })

  it('resume banner explains device-local vs Save draft', () => {
    const banner = read(
      'app/(partner)/partner/listings/new/components/chrome/WizardResumeDraftBanner.jsx',
    )
    assert.match(banner, /wizardResumeDraftHint/)
    const i18n = read('lib/translations/listings-partner-wizard.js')
    assert.match(i18n, /wizardResumeDraftHint:/)
  })
})
