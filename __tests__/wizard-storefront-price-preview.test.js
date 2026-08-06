/**
 * Stage 200.49 — wizard preview L1 asset → THB before guest display FX.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/wizard-storefront-price-preview.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('computeWizardStorefrontPricePreview (Stage 200.49)', () => {
  it('does not treat EUR asset amount as THB (regress ₽4.4k for €1500)', async () => {
    const { computeWizardStorefrontPricePreview } = await import(
      '@/lib/pricing/fx-display-client.js'
    )
    // mid: 1 EUR = 37 THB; retail RUB: 1 RUB = 2.95 THB → guest THB / 2.95
    const mid = { THB: 1, EUR: 37, RUB: 2.9 }
    const retail = { THB: 1, EUR: 38, RUB: 2.95 }
    const out = computeWizardStorefrontPricePreview(1500, { guestServiceFeePercent: 0 }, {
      listingBaseCurrency: 'EUR',
      midExchangeRates: mid,
      retailExchangeRates: retail,
    })
    assert.equal(out.base, 55500)
    assert.equal(out.storefrontGuestDisplayThb, 55500)
    assert.ok(out.storefrontGuestDisplayThb > 10000, 'must be far above fake-THB path (~1500)')
  })

  it('THB listing keeps asset as base', async () => {
    const { computeWizardStorefrontPricePreview } = await import(
      '@/lib/pricing/fx-display-client.js'
    )
    const out = computeWizardStorefrontPricePreview(1500, { guestServiceFeePercent: 0 }, {
      listingBaseCurrency: 'THB',
      midExchangeRates: { THB: 1 },
    })
    assert.equal(out.base, 1500)
    assert.equal(out.storefrontGuestDisplayThb, 1500)
  })

  it('returns base 0 when FX missing for non-THB (no silent THB misread)', async () => {
    const { computeWizardStorefrontPricePreview } = await import(
      '@/lib/pricing/fx-display-client.js'
    )
    const out = computeWizardStorefrontPricePreview(1500, { guestServiceFeePercent: 0 }, {
      listingBaseCurrency: 'EUR',
      midExchangeRates: { THB: 1 },
    })
    assert.equal(out.base, 0)
    assert.equal(out.storefrontGuestDisplayThb, 0)
    assert.equal(out.fxReady, false)
  })

  it('RUB asset: does not treat 4200₽ as THB (regress ~₽12.4k guest)', async () => {
    const { computeWizardStorefrontPricePreview, convertThbToDisplayCurrency } = await import(
      '@/lib/pricing/fx-display-client.js'
    )
    // Live-like: ~2.95 ₽/฿ → rate_to_thb ≈ 0.339 (or legacy 2.95 normalized via invert)
    const rates = { THB: 1, RUB: 2.95, USD: 33.1 }
    const out = computeWizardStorefrontPricePreview(4200, { guestServiceFeePercent: 0 }, {
      listingBaseCurrency: 'RUB',
      midExchangeRates: rates,
      retailExchangeRates: rates,
    })
    const fakeThbPathRub = convertThbToDisplayCurrency(4200, 'RUB', rates)
    assert.ok(fakeThbPathRub > 10000, 'sanity: old bug path ≈₽12k')
    assert.ok(out.base > 1000 && out.base < 3000, `canon THB for 4200₽, got ${out.base}`)
    const guestRub = convertThbToDisplayCurrency(out.storefrontGuestDisplayThb, 'RUB', rates)
    assert.ok(Math.abs(guestRub - 4200) < 5, `guest ₽ should ≈4200, got ${guestRub}`)
  })

  it('USD asset: converts via mid before guest display (not raw dollars as THB)', async () => {
    const { computeWizardStorefrontPricePreview, convertThbToDisplayCurrency } = await import(
      '@/lib/pricing/fx-display-client.js'
    )
    const rates = { THB: 1, USD: 33.12, RUB: 2.95 }
    const out = computeWizardStorefrontPricePreview(100, { guestServiceFeePercent: 0 }, {
      listingBaseCurrency: 'USD',
      midExchangeRates: rates,
      retailExchangeRates: rates,
    })
    assert.equal(out.base, 3312)
    const asRub = convertThbToDisplayCurrency(out.storefrontGuestDisplayThb, 'RUB', rates)
    const fakeThbAsRub = convertThbToDisplayCurrency(100, 'RUB', rates)
    assert.ok(asRub > fakeThbAsRub * 10, 'must not look like $100 treated as ฿100')
  })
})
