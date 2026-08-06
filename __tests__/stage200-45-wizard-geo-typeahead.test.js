/**
 * Stage 200.45 — country/city typeahead + provisional name normalize.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-45-wizard-geo-typeahead.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.45 — normalize geo place names', () => {
  it('trims, collapses spaces, title-cases, and keys ignore case', async () => {
    const { normalizeGeoPlaceName, normalizeGeoPlaceKey } = await import(
      '../lib/geo/normalize-geo-place-name.js'
    )
    assert.equal(normalizeGeoPlaceName('  москва  '), 'Москва')
    assert.equal(normalizeGeoPlaceName('new   york'), 'New York')
    assert.equal(normalizeGeoPlaceKey('Москва '), normalizeGeoPlaceKey('москва'))
    assert.equal(normalizeGeoPlaceKey('Ёлки'), normalizeGeoPlaceKey('елки'))
  })
})

describe('Stage 200.45 — ISO country catalog', () => {
  it('lists and filters ISO countries including DE / RU', async () => {
    const { listIsoCountries, filterIsoCountries, getIsoCountryLabel } = await import(
      '../lib/geo/iso-countries-catalog.js'
    )
    const list = listIsoCountries({ lang: 'ru' })
    assert.ok(list.length > 100)
    assert.ok(list.some((c) => c.code === 'DE'))
    assert.ok(list.some((c) => c.code === 'RU'))
    assert.match(getIsoCountryLabel('TH', 'ru'), /Таиланд/i)
    const hits = filterIsoCountries(list, 'герм', 5)
    assert.ok(hits.some((c) => c.code === 'DE'))
  })
})

describe('Stage 200.45 — wizard wires typeahead + ensure-country', () => {
  it('StepLocation uses WizardCountryTypeahead and WizardCityTypeahead', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepLocation.jsx')
    assert.match(src, /WizardCountryTypeahead/)
    assert.match(src, /WizardCityTypeahead/)
    assert.match(src, /ensure-country/)
    assert.doesNotMatch(src, /countries\.map\(\(c\)/)
  })

  it('GeoService exports ensureCountryLocation', () => {
    const src = read('lib/services/geo/geo.service.js')
    assert.match(src, /async ensureCountryLocation/)
    assert.match(src, /normalizeGeoPlaceName/)
  })

  it('provisional route normalizes names', () => {
    const src = read('app/api/v2/partner/geo/provisional/route.js')
    assert.match(src, /normalizeGeoPlaceName/)
    assert.match(src, /normalizeGeoPlaceKey/)
    assert.match(src, /ensureCountryLocation/)
  })
})
