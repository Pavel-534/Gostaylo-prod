/**
 * Stage 200.30 — wizard pin → country cascade / TZ / asset currency SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/wizard-geo-from-pin.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('resolveWizardGeoFromPin / mergeWizardFormGeoFromPin', () => {
  it('maps Saint Petersburg coords to RU-SPB + Europe/Moscow + RUB', async () => {
    const { resolveWizardGeoFromPin, mergeWizardFormGeoFromPin } = await import(
      '../lib/geo/wizard-geo-from-pin.js'
    )
    const r = resolveWizardGeoFromPin({
      lat: 59.93,
      lon: 30.36,
      countryCode: 'ru',
      country: 'Russia',
      city: 'Saint Petersburg',
      state: 'Saint Petersburg',
      district: 'Tsentralny',
    })
    assert.ok(r)
    assert.equal(r.country, 'RU')
    assert.equal(r.region, 'RU-SPB')
    assert.equal(r.city, 'spb')
    assert.equal(r.timezone, 'Europe/Moscow')
    assert.equal(r.baseCurrency, 'RUB')

    const merged = mergeWizardFormGeoFromPin(
      {
        country: 'TH',
        region: 'TH-PHK',
        city: 'phuket-city',
        district: 'Rawai',
        baseCurrency: 'THB',
        metadata: { timezone: 'Asia/Bangkok' },
      },
      {
        lat: 59.93,
        lon: 30.36,
        geo: {
          countryCode: 'RU',
          country: 'Russia',
          city: 'Saint Petersburg',
          district: 'Центральный',
        },
      },
    )
    assert.equal(merged.country, 'RU')
    assert.equal(merged.region, 'RU-SPB')
    assert.equal(merged.city, 'spb')
    assert.equal(merged.baseCurrency, 'RUB')
    assert.equal(merged.metadata.timezone, 'Europe/Moscow')
    assert.equal(merged.latitude, 59.93)
    assert.equal(merged.longitude, 30.36)
  })

  it('keeps baseCurrency when financially locked', async () => {
    const { mergeWizardFormGeoFromPin } = await import('../lib/geo/wizard-geo-from-pin.js')
    const merged = mergeWizardFormGeoFromPin(
      {
        country: 'TH',
        region: 'TH-PHK',
        city: 'phuket-city',
        baseCurrency: 'THB',
        metadata: { timezone: 'Asia/Bangkok' },
      },
      {
        lat: 59.93,
        lon: 30.36,
        baseCurrencyLocked: true,
        geo: { countryCode: 'RU', country: 'Russia', city: 'Saint Petersburg' },
      },
    )
    assert.equal(merged.country, 'RU')
    assert.equal(merged.baseCurrency, 'THB')
  })

  it('maps Phuket pin to TH cascade + Asia/Bangkok + THB', async () => {
    const { resolveWizardGeoFromPin } = await import('../lib/geo/wizard-geo-from-pin.js')
    const r = resolveWizardGeoFromPin({
      lat: 7.88,
      lon: 98.39,
      countryCode: 'th',
      country: 'Thailand',
      city: 'Phuket',
    })
    assert.equal(r.country, 'TH')
    assert.equal(r.region, 'TH-PHK')
    assert.equal(r.timezone, 'Asia/Bangkok')
    assert.equal(r.baseCurrency, 'THB')
  })
})
