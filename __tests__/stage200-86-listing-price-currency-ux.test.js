/**
 * Stage 200.86 — listing price currency / same-currency guest display / draft seed.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-86-listing-price-currency-ux.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.86 — draft seed & geo save gate', () => {
  it('ensureWizardDraftListing does not force 100 THB', () => {
    const src = read('lib/partner/ensure-wizard-draft-listing.js')
    assert.doesNotMatch(src, /Math\.max\(100/)
    assert.match(src, /getDefaultListingBaseCurrency/)
  })

  it('useListingSave create draft does not force 100 THB', () => {
    const src = read('app/(partner)/partner/listings/new/hooks/useListingSave.js')
    assert.doesNotMatch(src, /Math\.max\(100/)
  })

  it('PATCH requireCoords only when publishing or body has real coords', () => {
    const src = read('app/api/v2/partner/listings/[id]/route.js')
    assert.match(src, /bodyHasCoords/)
    assert.match(src, /requireCoords: publishing \|\| bodyHasCoords/)
  })

  it('listingBasePriceSchema allows 0 for drafts', () => {
    const src = read('lib/validations/listing.js')
    assert.match(src, /\.min\(0/)
    assert.doesNotMatch(src, /\.positive\(/)
  })
})

describe('Stage 200.86 — same-currency guest display', () => {
  it('wizard preview uses L1×fee without retail round-trip', async () => {
    const { computeWizardStorefrontPricePreview } = await import(
      '@/lib/pricing/fx-display-client.js'
    )
    const out = computeWizardStorefrontPricePreview(5200, { guestServiceFeePercent: 15 }, {
      listingBaseCurrency: 'RUB',
      midExchangeRates: { THB: 1, RUB: 0.018 },
      retailExchangeRates: { THB: 1, RUB: 0.017 },
    })
    assert.equal(out.storefrontInListingCurrency, 5980)
    assert.equal(out.sitePriceSameCurrency, 5980)
  })

  it('formatSameCurrencyGuestDisplay uses asset×fee', async () => {
    const { formatSameCurrencyGuestDisplay, getSameCurrencyGuestNativeAmount } = await import(
      '@/lib/pricing/same-currency-guest-display.js'
    )
    const listing = {
      base_currency: 'RUB',
      metadata: {
        base_price_asset: { amount: 5200, currency: 'RUB', rate_thb_per_unit_mid: 0.018 },
      },
    }
    assert.equal(getSameCurrencyGuestNativeAmount(listing, 'RUB', 15), 5980)
    assert.equal(getSameCurrencyGuestNativeAmount(listing, 'USD', 15), null)
    const formatted = formatSameCurrencyGuestDisplay(listing, 'RUB', 'ru', 15)
    assert.match(String(formatted), /5\s?980|5980/)
  })
})

describe('Stage 200.86 — admin & pricing UI wiring', () => {
  it('moderation does not hardcode baht glyph for list price', () => {
    const src = read('app/admin/moderation/page.js')
    assert.match(src, /resolveModerationListingPriceDisplay/)
    assert.doesNotMatch(src, /฿\{listing\.base_price_thb/)
  })

  it('StepPricing locks currency to country', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepPricing.jsx')
    assert.match(src, /getDefaultListingBaseCurrency/)
    assert.match(src, /currencyLockedToCountry/)
    assert.match(src, /wizardBaseCurrencyFromCountryHint/)
  })
})
