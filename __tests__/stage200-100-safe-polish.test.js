/**
 * Stage 200.100 — safe polish: RU plurals, cancellation section title, trust text-xs.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-100-safe-polish.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.100 — safe polish', () => {
  it('RU plurals for bedrooms / bathrooms / guests', async () => {
    const {
      pluralizeBedrooms,
      pluralizeBathrooms,
      pluralizeGuests,
      pluralizeListings,
      formatUpToGuestsLabel,
    } = await import('@/lib/i18n/pluralize.js')
    assert.equal(pluralizeBedrooms(1, 'ru'), 'спальня')
    assert.equal(pluralizeBedrooms(2, 'ru'), 'спальни')
    assert.equal(pluralizeBedrooms(5, 'ru'), 'спален')
    assert.equal(pluralizeBedrooms(21, 'ru'), 'спальня')
    assert.equal(pluralizeBathrooms(1, 'ru'), 'ванная')
    assert.equal(pluralizeBathrooms(3, 'ru'), 'ванные')
    assert.equal(pluralizeBathrooms(11, 'ru'), 'ванных')
    assert.equal(pluralizeGuests(1, 'ru'), 'гость')
    assert.equal(pluralizeListings(1, 'ru'), 'объект')
    assert.equal(pluralizeListings(2, 'ru'), 'объекта')
    assert.equal(pluralizeListings(5, 'ru'), 'объектов')
    assert.equal(pluralizeListings(21, 'ru'), 'объект')
    assert.equal(pluralizeListings(22, 'ru'), 'объекта')
    assert.equal(pluralizeListings(12, 'ru'), 'объектов')
    assert.equal(formatUpToGuestsLabel(1, 'ru'), 'До 1 гостя')
    assert.equal(formatUpToGuestsLabel(2, 'ru'), 'До 2 гостей')
    assert.equal(formatUpToGuestsLabel(5, 'ru'), 'До 5 гостей')
  })

  it('PDP specs use plural helpers; cancellation is section title', () => {
    const specs = read('components/listing/ListingCardSpecsRow.jsx')
    assert.match(specs, /pluralizeBedrooms/)
    assert.match(specs, /pluralizeBathrooms/)
    assert.match(specs, /formatUpToGuestsLabel/)
    const pricing = read('app/(partner)/partner/listings/new/components/StepPricing.jsx')
    assert.match(pricing, /pricing-cancellation/)
    assert.match(pricing, /PARTNER_SECTION_TITLE_CLASS/)
    assert.match(pricing, /partnerEdit_cancellationPolicy/)
  })

  it('home top listings has no count subtitle under the title', () => {
    const src = read('components/home/TopListingsGrid.jsx')
    assert.doesNotMatch(src, /pluralizeListings/)
    assert.match(src, /pt-8 pb-8/)
  })

  it('trust compact is at least text-xs', () => {
    const trust = read('components/listing/booking/BookingTrustSignals.jsx')
    assert.match(trust, /text-xs leading-relaxed/)
    assert.doesNotMatch(trust, /text-\[10px\]/)
  })
})
