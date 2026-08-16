/**
 * Stage 201.57 — wizard currency clobber, vehicle amenities, draft+beforeunload on publish.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-57-wizard-currency-amenities-publish.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.57 — wizard currency / vehicle amenities / publish leave', () => {
  it('publish PATCH keeps post-priceWrite base_price_asset', () => {
    const src = read('app/api/v2/partner/listings/[id]/route.js')
    assert.match(src, /Keep post-priceWrite L1 asset/)
    assert.match(src, /priceAsset/)
    assert.match(src, /base_price_asset = priceAsset/)
  })

  it('partner list display ignores stale zero USD asset when ledger > 0', async () => {
    const { resolvePartnerListingPriceParts } = await import(
      '../lib/partner/partner-listing-price-display.js'
    )
    const parts = resolvePartnerListingPriceParts({
      basePriceThb: 500,
      baseCurrency: 'THB',
      basePriceAsset: { amount: 0, currency: 'USD' },
    })
    assert.equal(parts.hasAssetAmount, false)
    assert.equal(parts.primaryAmount, 500)
    assert.equal(parts.primaryCurrency, 'THB')
  })

  it('draft create defaults to THB not USD when country unknown', () => {
    assert.match(read('lib/partner/ensure-wizard-draft-listing.js'), /\|\|\s*'THB'/)
    assert.match(
      read('app/(partner)/partner/listings/new/hooks/useListingSave.js'),
      /baseCurrency:\s*geoForm\.baseCurrency \|\| 'THB'/,
    )
  })

  it('vehicle amenities are rental features (≥3), not parking/AC only', () => {
    const {
      VEHICLE_PARTNER_AMENITY_SLUGS,
      AMENITY_SLUGS,
    } = require('../lib/listing-wizard-amenities.js')
    assert.ok(VEHICLE_PARTNER_AMENITY_SLUGS.length >= 3)
    assert.ok(VEHICLE_PARTNER_AMENITY_SLUGS.includes('helmets'))
    assert.ok(VEHICLE_PARTNER_AMENITY_SLUGS.includes('delivery'))
    assert.ok(!VEHICLE_PARTNER_AMENITY_SLUGS.includes('parking'))
    assert.ok(!VEHICLE_PARTNER_AMENITY_SLUGS.includes('ac'))
    assert.ok(AMENITY_SLUGS.includes('helmets'))
  })

  it('last step has save-draft CTA; publish clears beforeunload', () => {
    const actions = read(
      'app/(partner)/partner/listings/new/components/chrome/ListingWizardStepActions.jsx',
    )
    assert.match(actions, /wizard-last-step-save-draft/)
    assert.match(actions, /saveDraft/)

    const save = read('app/(partner)/partner/listings/new/hooks/useListingSave.js')
    assert.match(save, /markWizardCleanForLeave/)

    const inner = read(
      'app/(partner)/partner/listings/new/components/ListingWizardPageInner.jsx',
    )
    assert.match(inner, /skipBeforeUnloadRef/)
  })
})
