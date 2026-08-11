/**
 * Stage 200.96 — live wizard preview price + in-app view-on-site + PDP same-currency hero.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-96-wizard-preview-price.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.96 — preview price + view on site', () => {
  it('readBasePriceAsset prefers top-level basePriceAsset over stale metadata', async () => {
    const { readBasePriceAssetFromListing } = await import('@/lib/listing/read-base-price-asset.js')
    const listing = {
      basePriceAsset: { amount: 5700, currency: 'RUB' },
      metadata: {
        base_price_asset: {
          amount: 5400,
          currency: 'RUB',
          rate_thb_per_unit_mid: 0.4,
          converted_at: '2026-08-01T00:00:00.000Z',
        },
      },
    }
    assert.equal(readBasePriceAssetFromListing(listing)?.amount, 5700)
  })

  it('same-currency guest display uses live L1 (5700×1.15=6555), not stale 5400', async () => {
    const { getSameCurrencyGuestNativeAmount } = await import(
      '@/lib/pricing/same-currency-guest-display.js'
    )
    const listing = {
      baseCurrency: 'RUB',
      basePriceAsset: { amount: 5700, currency: 'RUB' },
      metadata: {
        base_price_asset: { amount: 5400, currency: 'RUB' },
        guest_service_fee_percent: 15,
      },
    }
    assert.equal(getSameCurrencyGuestNativeAmount(listing, 'RUB'), 6555)
    assert.notEqual(getSameCurrencyGuestNativeAmount(listing, 'RUB'), 6210)
  })

  it('wizard preview payloads overwrite metadata.base_price_asset from form', () => {
    const eye = read(
      'app/(partner)/partner/listings/new/components/preview/ListingWizardPreviewContent.jsx',
    )
    const step = read('app/(partner)/partner/listings/new/components/StepPreview.jsx')
    for (const src of [eye, step]) {
      assert.match(src, /base_price_asset:\s*\{/)
      assert.match(src, /amount:\s*Number\(formData\.basePriceThb\)/)
    }
  })

  it('view on site stays in-app (no target=_blank)', () => {
    const actions = read('components/partner/listings/PartnerListingCardActions.jsx')
    assert.match(actions, /href=\{`\/listings\/\$\{listing\.id\}`\}/)
    assert.doesNotMatch(actions, /target="_blank"/)
    assert.doesNotMatch(actions, /ExternalLink/)
  })

  it('PDP hero uses same-currency SSOT for per-night', () => {
    const widget = read('components/listing/BookingWidget.jsx')
    assert.match(widget, /formatSameCurrencyGuestDisplay/)
    assert.match(widget, /hero\.mode === 'perNight'/)
  })
})
