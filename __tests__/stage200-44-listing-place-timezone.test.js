/**
 * Stage 200.44 — place TZ (pin/city) + country currency.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-44-listing-place-timezone.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('Stage 200.44 — offline pin → IANA', () => {
  it('guessIanaTimezoneFromLatLon covers multi-TZ Russia and Thailand', async () => {
    const { guessIanaTimezoneFromLatLon } = await import('../lib/geo/listing-timezone-guess.js')
    assert.equal(guessIanaTimezoneFromLatLon(55.75, 37.62), 'Europe/Moscow')
    assert.equal(guessIanaTimezoneFromLatLon(55.03, 82.92), 'Asia/Novosibirsk')
    assert.equal(guessIanaTimezoneFromLatLon(43.12, 131.89), 'Asia/Vladivostok')
    assert.equal(guessIanaTimezoneFromLatLon(13.7563, 100.5018), 'Asia/Bangkok')
    assert.equal(guessIanaTimezoneFromLatLon(null, null), '')
  })

  it('resolveListingPlaceTimezone: pin beats country-row TZ', async () => {
    const { resolveListingPlaceTimezone } = await import('../lib/geo/listing-timezone-guess.js')
    assert.equal(
      resolveListingPlaceTimezone({
        lat: 43.12,
        lon: 131.89,
        countryCode: 'RU',
        explicitTimezone: 'Europe/Moscow',
      }),
      'Asia/Vladivostok',
    )
    assert.equal(
      resolveListingPlaceTimezone({
        countryCode: 'RU',
        cityTimezone: 'Asia/Novosibirsk',
      }),
      'Asia/Novosibirsk',
    )
    assert.equal(resolveListingPlaceTimezone({ countryCode: 'RU' }), 'Europe/Moscow')
    assert.equal(resolveListingPlaceTimezone({ countryCode: 'TH' }), 'Asia/Bangkok')
  })
})

describe('Stage 200.44 — pin merge currency + TZ', () => {
  it('Vladivostok pin → Asia/Vladivostok + RUB (not Moscow)', async () => {
    const { resolveWizardGeoFromPin, mergeWizardFormGeoFromPin } = await import(
      '../lib/geo/wizard-geo-from-pin.js'
    )
    const r = resolveWizardGeoFromPin({
      lat: 43.12,
      lon: 131.89,
      countryCode: 'RU',
      city: 'Vladivostok',
      timezone: 'Europe/Moscow',
    })
    assert.equal(r.timezone, 'Asia/Vladivostok')
    assert.equal(r.baseCurrency, 'RUB')

    const merged = mergeWizardFormGeoFromPin(
      {
        country: 'TH',
        baseCurrency: 'THB',
        metadata: { timezone: 'Asia/Bangkok' },
      },
      {
        lat: 43.12,
        lon: 131.89,
        geo: {
          countryCode: 'RU',
          city: 'Vladivostok',
          timezone: 'Europe/Moscow',
        },
      },
    )
    assert.equal(merged.country, 'RU')
    assert.equal(merged.baseCurrency, 'RUB')
    assert.equal(merged.metadata.timezone, 'Asia/Vladivostok')
  })

  it('Novosibirsk hub → Asia/Novosibirsk + RUB', async () => {
    const { resolveWizardGeoFromPin } = await import('../lib/geo/wizard-geo-from-pin.js')
    const r = resolveWizardGeoFromPin({
      lat: 55.03,
      lon: 82.92,
      countryCode: 'RU',
      city: 'Novosibirsk',
    })
    assert.equal(r.region, 'RU-NVS')
    assert.equal(r.city, 'novosibirsk')
    assert.equal(r.timezone, 'Asia/Novosibirsk')
    assert.equal(r.baseCurrency, 'RUB')
  })

  it('Thailand pin from RU draft → THB + Asia/Bangkok', async () => {
    const { mergeWizardFormGeoFromPin } = await import('../lib/geo/wizard-geo-from-pin.js')
    const merged = mergeWizardFormGeoFromPin(
      {
        country: 'RU',
        baseCurrency: 'RUB',
        metadata: { timezone: 'Europe/Moscow' },
      },
      {
        lat: 7.8804,
        lon: 98.3923,
        geo: { countryCode: 'TH', city: 'Phuket', timezone: 'Europe/Moscow' },
      },
    )
    assert.equal(merged.country, 'TH')
    assert.equal(merged.baseCurrency, 'THB')
    assert.equal(merged.metadata.timezone, 'Asia/Bangkok')
  })
})
