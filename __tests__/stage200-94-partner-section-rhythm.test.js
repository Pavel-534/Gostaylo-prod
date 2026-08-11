/**
 * Stage 200.94 — Partner section rhythm (padding + mint dividers + listing cards).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-94-partner-section-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.94 — partner section rhythm', () => {
  it('wizard chrome padding includes gap above/below fixed bars', () => {
    const layout = read(
      'app/(partner)/partner/listings/new/components/chrome/listing-wizard-layout.js',
    )
    assert.match(layout, /WIZARD_MOBILE_CHROME_HEIGHT = '5\.75rem'/)
    assert.match(layout, /WIZARD_MOBILE_ACTION_BAR_HEIGHT = '5rem'/)
    assert.match(layout, /pt-\[calc\(5\.75rem\+0\.75rem\)\]/)
    assert.match(layout, /pb-\[calc\(5rem\+0\.75rem\+env\(safe-area-inset-bottom/)
  })

  it('PartnerSectionDivider uses mint hairline SSOT', () => {
    const rhythm = read('lib/ui/partner-section-rhythm.js')
    assert.match(rhythm, /PARTNER_SECTION_DIVIDER_CLASS/)
    assert.match(rhythm, /brand-mint\/20/)
    assert.match(rhythm, /mx-4/)
    assert.match(rhythm, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(rhythm, /PARTNER_FIELD_LABEL_CLASS/)
    assert.match(rhythm, /PARTNER_LISTING_CARD_SURFACE_CLASS/)
    const comp = read('components/partner/PartnerSectionDivider.jsx')
    assert.match(comp, /partner-section-divider/)
    assert.match(comp, /PARTNER_SECTION_DIVIDER_CLASS/)
  })

  it('Location and Calendar pilot use PartnerSectionDivider', () => {
    const loc = read('app/(partner)/partner/listings/new/components/StepLocation.jsx')
    assert.match(loc, /PartnerSectionDivider/)
    assert.match(loc, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(loc, /geo-street/)
    assert.match(loc, /geo-map/)
    const cal = read('app/(partner)/partner/listings/new/components/StepCalendarSection.jsx')
    assert.match(cal, /PartnerSectionDivider/)
    assert.match(cal, /calendar-sync|calendar-blocks|calendar-seasons/)
  })

  it('street helper sits under inputs; map helper under MapPicker', () => {
    const street = read(
      'app/(partner)/partner/listings/new/components/WizardStreetTypeahead.jsx',
    )
    const hintIdx = street.indexOf("wizardGeo_addressSuggestHint")
    const streetInputIdx = street.indexOf('wizard-street-input')
    assert.ok(hintIdx > streetInputIdx, 'street hint should appear after street input')
    const loc = read('app/(partner)/partner/listings/new/components/StepLocation.jsx')
    const mapIdx = loc.indexOf('<MapPicker')
    const mapHintIdx = loc.indexOf('wizardGeo_mapHintAfterCascade')
    assert.ok(mapHintIdx > mapIdx, 'map hint should appear after MapPicker')
  })

  it('partner listings cards use soft surface + mint accent', () => {
    const page = read('app/(partner)/partner/listings/page.js')
    assert.match(page, /PARTNER_LISTING_CARD_SURFACE_CLASS/)
    assert.match(page, /space-y-3/)
  })

  it('street section title i18n in 4 locales', () => {
    const src = read('lib/translations/listings-partner-wizard.js')
    const matches = src.match(/wizardGeo_streetSectionTitle:/g)
    assert.equal(matches?.length, 4)
  })
})
