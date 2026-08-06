/**
 * Stage 200.47 — non-launch currency map + provisional write invariants.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-47-non-launch-currency-provisional.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

describe('Stage 200.47 — country currency map', () => {
  it('maps major ISO codes and USD fallback', async () => {
    const {
      getDefaultListingBaseCurrency,
      resolveEnforcedListingBaseCurrency,
    } = await import('@/lib/listing/listing-asset-currency.js')

    assert.equal(getDefaultListingBaseCurrency('DE'), 'EUR')
    assert.equal(getDefaultListingBaseCurrency('FR'), 'EUR')
    assert.equal(getDefaultListingBaseCurrency('GB'), 'GBP')
    assert.equal(getDefaultListingBaseCurrency('CN'), 'CNY')
    assert.equal(getDefaultListingBaseCurrency('HK'), 'HKD')
    assert.equal(getDefaultListingBaseCurrency('JP'), 'JPY')
    assert.equal(getDefaultListingBaseCurrency('KR'), 'KRW')
    assert.equal(getDefaultListingBaseCurrency('SG'), 'SGD')
    assert.equal(getDefaultListingBaseCurrency('MY'), 'MYR')
    assert.equal(getDefaultListingBaseCurrency('AU'), 'AUD')
    assert.equal(getDefaultListingBaseCurrency('NZ'), 'NZD')
    assert.equal(getDefaultListingBaseCurrency('CA'), 'CAD')
    assert.equal(getDefaultListingBaseCurrency('US'), 'USD')
    assert.equal(getDefaultListingBaseCurrency('RU'), 'RUB')
    assert.equal(getDefaultListingBaseCurrency('TH'), 'THB')
    assert.equal(getDefaultListingBaseCurrency('XX'), 'USD')
    assert.equal(getDefaultListingBaseCurrency(''), 'USD')

    const de = resolveEnforcedListingBaseCurrency({
      countryCode: 'DE',
      requestedCurrency: 'THB',
    })
    assert.equal(de.baseCurrency, 'EUR')
    assert.equal(de.source, 'country_map')
    assert.equal(de.overridden, true)

    const ru = resolveEnforcedListingBaseCurrency({
      countryCode: 'RU',
      requestedCurrency: 'EUR',
    })
    assert.equal(ru.baseCurrency, 'RUB')
    assert.equal(ru.source, 'ru_geo_invariant')

    const bare = resolveEnforcedListingBaseCurrency({
      requestedCurrency: 'ZZZ',
    })
    assert.equal(bare.baseCurrency, 'USD')
    assert.equal(bare.source, 'fallback_usd')
  })

  it('LISTING_BASE_CURRENCIES allowlist includes map currencies', async () => {
    const { LISTING_BASE_CURRENCIES, isListingBaseCurrency } = await import(
      '@/lib/finance/currency-codes.js'
    )
    for (const code of ['EUR', 'GBP', 'CNY', 'JPY', 'HKD', 'KRW', 'SGD', 'MYR', 'AUD', 'NZD', 'CAD']) {
      assert.equal(isListingBaseCurrency(code), true, code)
      assert.ok(LISTING_BASE_CURRENCIES.includes(code), code)
    }
  })
})

describe('Stage 200.47 — provisional + display label', () => {
  it('upsertProvisionalLocation uses place TZ resolver and dual labels', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../lib/services/geo/geo.service.js'),
      'utf8',
    )
    assert.match(src, /resolveListingPlaceTimezone/)
    assert.match(src, /centroid_lat: hasCentroid \? latN/)
    assert.match(src, /label_en: displayName/)
    assert.match(src, /label_ru: displayName/)
  })

  it('provisional route backfills centroid on reuse', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../app/api/v2/partner/geo/provisional/route.js'),
      'utf8',
    )
    assert.match(src, /needsCentroid/)
    assert.match(src, /centroid_lat/)
  })

  it('geo-display-label uses ISO country when seed missing', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../lib/locations/geo-display-label.js'),
      'utf8',
    )
    assert.match(src, /getIsoCountryLabel/)
  })

  it('sync label for DE listing uses city_label + ISO country (no Phuket)', async () => {
    const { formatListingLocationLineSync } = await import(
      '@/lib/locations/geo-display-label.js'
    )
    const line = formatListingLocationLineSync(
      {
        country_code: 'DE',
        district: 'Mitte',
        metadata: { city_label: 'Berlin', city: 'Berlin' },
      },
      'en',
    )
    assert.match(line, /Berlin/)
    assert.match(line, /Germany|DE/i)
    assert.doesNotMatch(line, /Phuket/i)
  })

  it('resolve-where does not filter is_auto_imported', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../lib/locations/resolve-where-target.js'),
      'utf8',
    )
    assert.doesNotMatch(src, /is_auto_imported/)
    assert.match(src, /is_active/)
  })
})
