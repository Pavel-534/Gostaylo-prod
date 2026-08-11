/**
 * Stage 200.95 — Wizard scroll clearance + Basics/Pricing section rhythm.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-95-wizard-section-rhythm.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.95 — wizard scroll + section rhythm', () => {
  it('pb utility has no comma inside env() (Tailwind arbitrary-value trap)', () => {
    const layout = read(
      'app/(partner)/partner/listings/new/components/chrome/listing-wizard-layout.js',
    )
    assert.match(layout, /WIZARD_MOBILE_ACTION_BAR_HEIGHT = '5rem'/)
    assert.match(layout, /WIZARD_MOBILE_ACTION_BAR_CONTENT_GAP = '0\.5rem'/)
    assert.match(layout, /pb-\[calc\(5rem\+0\.5rem\+env\(safe-area-inset-bottom\)\)\]/)
    assert.doesNotMatch(layout, /env\(safe-area-inset-bottom,/)
    assert.match(layout, /LISTING_WIZARD_SCROLL_ATTR/)
    assert.match(layout, /WIZARD_WORKSPACE_SCROLL_PAD_CLASS/)
    assert.match(layout, /scroll-padding-bottom/)
  })

  it('partner layout marks wizard scrollport for CSS + Tailwind pad', () => {
    const layout = read('app/(partner)/partner/layout.js')
    assert.match(layout, /LISTING_WIZARD_SCROLL_ATTR/)
    assert.match(layout, /WIZARD_WORKSPACE_SCROLL_PAD_CLASS/)
    assert.match(layout, /isListingWizardRoute && WIZARD_WORKSPACE_SCROLL_PAD_CLASS/)
    const css = read('app/globals.css')
    assert.match(css, /data-listing-wizard-scroll/)
    assert.match(css, /scroll-padding-bottom:\s*calc\(5rem/)
  })

  it('Basics uses PartnerSectionDivider + title/label SSOT', () => {
    const basics = read('app/(partner)/partner/listings/new/components/StepGeneralInfo.jsx')
    assert.match(basics, /PartnerSectionDivider/)
    assert.match(basics, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(basics, /PARTNER_FIELD_LABEL_CLASS/)
    assert.match(basics, /basics-identity/)
    assert.match(basics, /basics-copy/)
    assert.match(basics, /basics-specs/)
    const dividerCount = (basics.match(/<PartnerSectionDivider/g) || []).length
    assert.ok(dividerCount >= 2, `expected ≥2 dividers on Basics, got ${dividerCount}`)
  })

  it('Pricing uses PartnerSectionDivider between semantic groups', () => {
    const pricing = read('app/(partner)/partner/listings/new/components/StepPricing.jsx')
    assert.match(pricing, /PartnerSectionDivider/)
    assert.match(pricing, /PARTNER_FIELD_LABEL_CLASS/)
    assert.match(pricing, /pricing-instant/)
    assert.match(pricing, /pricing-base/)
    assert.match(pricing, /pricing-cancellation/)
    assert.match(pricing, /pricing-seasons/)
    const dividerCount = (pricing.match(/<PartnerSectionDivider/g) || []).length
    assert.ok(dividerCount >= 4, `expected ≥4 dividers on Pricing, got ${dividerCount}`)
  })

  it('grammar helper yields RU genitive for Недвижимость', async () => {
    const { formatWizardAddDetailsLine } = await import('@/lib/i18n/wizard-add-details-line.js')
    const tRu = (k) =>
      ({
        addDetailsFor: 'Добавьте детали для вашей',
        addDetailsForStay: 'Добавьте детали для вашей недвижимости.',
      })[k] || k
    const tEn = (k) =>
      ({
        addDetailsFor: 'Add details specific to your',
        addDetailsForStay: 'Add details for your property.',
      })[k] || k
    assert.equal(
      formatWizardAddDetailsLine(tRu, 'ru', 'Недвижимость'),
      'Добавьте детали для вашей недвижимости.',
    )
    assert.equal(
      formatWizardAddDetailsLine(tEn, 'en', 'Property'),
      'Add details specific to your property.',
    )
    assert.equal(formatWizardAddDetailsLine(tRu, 'ru', ''), 'Добавьте детали для вашей недвижимости.')
  })

  it('addDetailsForStay present in all 4 wizard locales', () => {
    const src = read('lib/translations/listings-partner-wizard.js')
    const matches = src.match(/addDetailsForStay:/g)
    assert.equal(matches?.length, 4)
  })
})
