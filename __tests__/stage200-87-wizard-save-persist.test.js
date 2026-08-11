/**
 * Stage 200.87 — wizard save: street/house metadata whitelist + redirect/cache wiring.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-87-wizard-save-persist.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.87 — street/house survive metadata normalize', () => {
  it('METADATA_KEYS_ALWAYS_ALLOWED includes street and house_number', async () => {
    const { getAllowedWizardMetadataKeys } = await import('@/lib/config/category-form-schema.js')
    const keys = getAllowedWizardMetadataKeys('villa', 'Villa', 'stay')
    assert.ok(keys.has('street'))
    assert.ok(keys.has('house_number'))
    assert.ok(keys.has('base_price_asset'))
  })

  it('normalizePartnerListingMetadata keeps street/house', async () => {
    const { normalizePartnerListingMetadata } = await import(
      '@/lib/partner/listing-wizard-metadata.js'
    )
    const out = normalizePartnerListingMetadata(
      {
        bedrooms: 1,
        street: 'Славянская',
        house_number: '12',
        city_label: 'Чита',
      },
      'villa',
      'Villa',
      'stay',
    )
    assert.equal(out.street, 'Славянская')
    assert.equal(out.house_number, '12')
  })
})

describe('Stage 200.87 — edit save redirect + list cache invalidate', () => {
  it('savePatchForEdit redirects to partner listings and invalidates RQ', () => {
    const src = read('app/(partner)/partner/listings/new/hooks/useListingSave.js')
    assert.match(src, /refreshPartnerListingsAfterSave|invalidatePartnerListingsCache/)
    assert.match(src, /listingsCacheOptsFromForm/)
    assert.match(src, /router\.push\('\/partner\/listings'\)/)
    assert.match(src, /coordsPayloadFromForm/)
  })

  it('load existing restores address from metadata street/house', () => {
    const src = read('app/(partner)/partner/listings/new/hooks/listing-wizard-load-existing.js')
    assert.match(src, /house_number/)
    assert.match(src, /rawMeta\.street/)
  })
})

describe('Stage 200.91 — partner list cache after price save', () => {
  it('usePartnerListings refetches on mount; save uses refetchType all', () => {
    const hook = read('lib/hooks/use-partner-listings.js')
    assert.match(hook, /refetchOnMount:\s*true/)
    assert.match(hook, /refetchType:\s*['"]all['"]/)
    assert.match(hook, /refreshPartnerListingsAfterSave/)
    assert.match(hook, /basePriceAsset/)
  })

  it('street input disables browser address autofill', () => {
    const src = read('app/(partner)/partner/listings/new/components/WizardStreetTypeahead.jsx')
    assert.match(src, /autoComplete="off"/)
    assert.doesNotMatch(src, /autoComplete="street-address"/)
  })
})
