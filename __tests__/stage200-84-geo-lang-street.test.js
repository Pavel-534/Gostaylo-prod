/**
 * Stage 200.84 — Nominatim lang + street address formatting + viewbox.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-84-geo-lang-street.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.84 — nominatim-lang helpers', () => {
  it('normalizes lang and builds viewbox', async () => {
    const {
      normalizeNominatimLang,
      cityViewboxFromCentroid,
      formatListingStreetAddress,
    } = await import('@/lib/geo/nominatim-lang.js')
    assert.equal(normalizeNominatimLang('ru-RU'), 'ru')
    assert.equal(normalizeNominatimLang('xx'), 'en')
    const vb = cityViewboxFromCentroid(52.28, 104.3, 0.2)
    const parts = vb.split(',').map(Number)
    assert.equal(parts.length, 4)
    assert.ok(Math.abs(parts[0] - 104.1) < 1e-9)
    assert.ok(Math.abs(parts[1] - 52.48) < 1e-9)
    assert.ok(Math.abs(parts[2] - 104.5) < 1e-9)
    assert.ok(Math.abs(parts[3] - 52.08) < 1e-9)
    assert.equal(
      formatListingStreetAddress({ road: 'улица Ленина', house_number: '12' }, 'ignored'),
      'улица Ленина, 12',
    )
    assert.equal(
      formatListingStreetAddress(null, '33, Timiryazeva Street, Irkutsk Oblast, Russia'),
      '33, Timiryazeva Street',
    )
  })
})

describe('Stage 200.84 — wiring', () => {
  it('GeoService reverse/search use Accept-Language + lang in cache key', () => {
    const src = read('lib/services/geo/geo.service.js')
    assert.match(src, /normalizeNominatimLang/)
    assert.match(src, /accept-language': lang/)
    assert.match(src, /`\$\{lang\}\|\$\{latN/)
    assert.match(src, /viewbox/)
    assert.doesNotMatch(src, /Accept-Language': 'en'/)
  })

  it('API routes pass lang; MapPicker fetches with lang', () => {
    assert.match(read('app/api/v2/geocode/reverse/route.js'), /lang/)
    assert.match(read('app/api/v2/geocode/suggest/route.js'), /viewbox/)
    assert.match(read('lib/api/geocode-client.js'), /opts\.lang/)
    assert.match(read('components/listing/MapPicker.jsx'), /fetchReverseGeocode\(lat, lng, \{ lang: language \}/)
    assert.match(read('components/listing/MapPicker.jsx'), /partnerPlaceHints/)
  })

  it('StepLocation: street+house, partner hints, lang reverse', () => {
    const src = read('app/(partner)/partner/listings/new/components/StepLocation.jsx')
    assert.match(src, /wizardGeo_streetOnlyLabel|onStreetChange/)
    assert.match(src, /partnerPlaceHints/)
    assert.match(src, /lang=\$\{encodeURIComponent\(language/)
    assert.match(src, /cityViewboxFromCentroid|cityLat/)
  })

  it('street suggestions dock under street field', () => {
    const src = read('app/(partner)/partner/listings/new/components/WizardStreetTypeahead.jsx')
    assert.match(src, /wizard-street-suggestions/)
    assert.match(src, /absolute left-0 right-0 top-full/)
    assert.match(src, /resultLines|formatListingStreetAddress/)
  })

  it('merge writes short street + UI-lang region label', () => {
    const src = read('lib/geo/wizard-geo-from-pin.js')
    assert.match(src, /formatListingStreetAddress/)
    assert.match(src, /launchGeoLabel\(uiLang/)
    assert.doesNotMatch(src, /launchGeoLabel\('en'/)
  })

  it('seed includes Irkutsk', async () => {
    const { LAUNCH_GEO_SEED } = await import('@/lib/geo/launch-markets-seed-data.js')
    assert.ok(LAUNCH_GEO_SEED.some((n) => n.code === 'irkutsk'))
    assert.ok(LAUNCH_GEO_SEED.some((n) => n.code === 'RU-IRK'))
  })
})
