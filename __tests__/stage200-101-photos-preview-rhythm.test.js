/**
 * Stage 200.101 — Photos + Preview wizard steps on partner section rhythm SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-101-photos-preview-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.101 — Photos + Preview section rhythm', () => {
  it('StepPhotos uses PartnerSectionDivider + title/label SSOT', () => {
    const photos = read('app/(partner)/partner/listings/new/components/StepPhotos.jsx')
    assert.match(photos, /PartnerSectionDivider/)
    assert.match(photos, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(photos, /PARTNER_FIELD_LABEL_CLASS/)
    assert.match(photos, /photos-upload/)
    assert.match(photos, /photos-gallery/)
    assert.match(photos, /photos-tips/)
    const dividerCount = (photos.match(/<PartnerSectionDivider/g) || []).length
    assert.ok(dividerCount >= 1, `expected ≥1 divider on Photos, got ${dividerCount}`)
    assert.match(photos, /handleImageUpload/)
    assert.match(photos, /ListingPhotoSortGrid/)
    assert.match(photos, /reorderImages/)
  })

  it('StepPreview uses section title + divider; keeps live pricingPreview', () => {
    const preview = read('app/(partner)/partner/listings/new/components/StepPreview.jsx')
    assert.match(preview, /PartnerSectionDivider/)
    assert.match(preview, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(preview, /preview-controls/)
    assert.match(preview, /preview-card/)
    assert.match(preview, /pricingPreview\?\.base/)
    assert.match(preview, /base_price_asset/)
    assert.match(preview, /storefrontGuestDisplayThb/)
    assert.doesNotMatch(preview, /target="_blank"/)
  })

  it('section i18n keys exist for ru/en', () => {
    const i18n = read('lib/translations/listings-partner-wizard.js')
    for (const key of [
      'wizardSection_photosUpload',
      'wizardSection_photosGallery',
      'wizardSection_photosTips',
      'wizardSection_previewReview',
      'wizardSection_previewCard',
    ]) {
      assert.ok(i18n.includes(`${key}:`), `missing ${key}`)
    }
  })
})
