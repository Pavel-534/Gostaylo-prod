/**
 * Stage 200.51 — cascade reset SSOT (camera vs pin).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-51-wizard-geo-cascade-reset.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.51 — applyWizardCountryCascadeReset', () => {
  it('clears dependents + pin + address; sets currency; create/edit same helper', async () => {
    const { applyWizardCountryCascadeReset } = await import(
      '@/lib/geo/wizard-geo-cascade-reset.js'
    )
    const prev = {
      country: 'DE',
      region: 'DE-BE',
      city: 'berlin',
      district: 'Mitte',
      address: 'Weinmeisterstraße 1',
      latitude: 52.52,
      longitude: 13.4,
      baseCurrency: 'EUR',
      metadata: {
        city_label: 'Berlin',
        city: 'Berlin',
        geo_pin_country: 'DE',
        timezone: 'Europe/Berlin',
      },
    }
    const next = applyWizardCountryCascadeReset(prev, {
      countryCode: 'TH',
      baseCurrencyLocked: false,
    })
    assert.equal(next.country, 'TH')
    assert.equal(next.region, '')
    assert.equal(next.city, '')
    assert.equal(next.district, '')
    assert.equal(next.address, '')
    assert.equal(next.latitude, null)
    assert.equal(next.longitude, null)
    assert.equal(next.baseCurrency, 'THB')
    assert.equal(next.metadata.city_label, '')
    assert.equal(next.metadata.geo_pin_country, undefined)
    assert.ok(String(next.metadata.timezone || '').includes('Bangkok') || next.metadata.timezone)
  })

  it('respects baseCurrencyLocked', async () => {
    const { applyWizardCountryCascadeReset } = await import(
      '@/lib/geo/wizard-geo-cascade-reset.js'
    )
    const next = applyWizardCountryCascadeReset(
      { country: 'DE', baseCurrency: 'EUR', metadata: {} },
      { countryCode: 'TH', baseCurrencyLocked: true },
    )
    assert.equal(next.baseCurrency, 'EUR')
    assert.equal(next.country, 'TH')
  })
})

describe('Stage 200.51 — city / region cascade', () => {
  it('city select clears pin+address; does not write lat/lng', async () => {
    const { applyWizardCityCascadeSelect } = await import(
      '@/lib/geo/wizard-geo-cascade-reset.js'
    )
    const next = applyWizardCityCascadeSelect(
      {
        country: 'TH',
        city: 'bangkok',
        address: 'old',
        latitude: 13.75,
        longitude: 100.5,
        metadata: { geo_pin_country: 'TH' },
      },
      {
        cityCode: 'phuket-city',
        cityLabel: 'Phuket',
        regionCode: 'TH-PHK',
        viewportLat: 7.88,
        viewportLon: 98.39,
      },
    )
    assert.equal(next.city, 'phuket-city')
    assert.equal(next.metadata.city_label, 'Phuket')
    assert.equal(next.region, 'TH-PHK')
    assert.equal(next.address, '')
    assert.equal(next.district, '')
    assert.equal(next.latitude, null)
    assert.equal(next.longitude, null)
  })

  it('region reset clears city and pin', async () => {
    const { applyWizardRegionCascadeReset } = await import(
      '@/lib/geo/wizard-geo-cascade-reset.js'
    )
    const next = applyWizardRegionCascadeReset(
      {
        country: 'TH',
        region: 'TH-BKK',
        city: 'x',
        latitude: 1,
        longitude: 2,
        metadata: { city_label: 'Bangkok' },
      },
      { regionCode: 'TH-PHK', viewportLat: 7.88, viewportLon: 98.39 },
    )
    assert.equal(next.region, 'TH-PHK')
    assert.equal(next.city, '')
    assert.equal(next.latitude, null)
  })
})

describe('Stage 200.51 — StepLocation wiring', () => {
  it('uses cascade SSOT and does not auto-pin on city suggest', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepLocation.jsx')
    assert.match(src, /applyWizardCountryCascadeReset/)
    assert.match(src, /applyWizardCityCascadeSelect/)
    assert.match(src, /applyWizardRegionCascadeReset/)
    assert.doesNotMatch(
      src,
      /!hasValidPin\(formData\) && Number\.isFinite\(lat\).*handleMapSelect/s,
    )
    assert.match(src, /Camera follows city; pin cleared/)
  })
})
