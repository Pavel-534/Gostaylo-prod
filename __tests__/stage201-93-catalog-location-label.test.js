/**
 * Stage 201.93 — catalog location line: UI lang from geo codes + seed, not raw OSM.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-93-catalog-location-label.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('path')

const root = path.join(__dirname, '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.93 — catalog location labels', () => {
  it('Thai OSM district + Phuket city code localizes to RU without Thai script', async () => {
    const { formatListingLocationLineSync } = await import('@/lib/locations/geo-display-label.js')
    const line = formatListingLocationLineSync(
      {
        district: 'บ้านกะรน',
        city_code: 'phuket-city',
        country_code: 'TH',
      },
      'ru',
    )
    assert.match(line, /Карон/)
    assert.match(line, /Пхукет/)
    assert.match(line, /Таиланд/)
    assert.doesNotMatch(line, /[\u0E00-\u0E7F]/)
  })

  it('empty district + Chita codes still shows city on RU UI', async () => {
    const { formatListingLocationLineSync } = await import('@/lib/locations/geo-display-label.js')
    const line = formatListingLocationLineSync(
      {
        district: '',
        city_code: 'chita',
        country_code: 'RU',
      },
      'ru',
    )
    assert.match(line, /Чита/)
    assert.match(line, /Россия/)
  })

  it('collapses duplicate Patong and localizes on RU', async () => {
    const { formatListingLocationLineSync } = await import('@/lib/locations/geo-display-label.js')
    const line = formatListingLocationLineSync(
      {
        district: 'Patong, Patong',
        city_code: 'phuket-city',
        country_code: 'TH',
      },
      'ru',
    )
    assert.match(line, /Патонг/)
    assert.match(line, /Пхукет/)
    assert.equal(line.split(/Патонг/i).length - 1, 1)
  })

  it('DE listing keeps Berlin + Germany and never invents Phuket', async () => {
    const { formatListingLocationLineSync } = await import('@/lib/locations/geo-display-label.js')
    const line = formatListingLocationLineSync(
      {
        country_code: 'DE',
        district: 'Mitte',
        metadata: { city_label: 'Berlin', city: 'Berlin' },
      },
      'en',
    )
    assert.match(line, /Berlin/)
    assert.match(line, /Germany/i)
    assert.doesNotMatch(line, /Phuket/i)
    assert.doesNotMatch(line, /\bDE\b/)
  })

  it('does not N+1 listing-label when launch seed already has the city', async () => {
    const { listingLocationNeedsGeoEnrichment } = await import(
      '@/lib/locations/geo-display-label.js'
    )
    assert.equal(
      listingLocationNeedsGeoEnrichment(
        { city_code: 'phuket-city', country_code: 'TH' },
        'ru',
      ),
      false,
    )
    assert.equal(
      listingLocationNeedsGeoEnrichment(
        { city_code: 'berlin-de-unknown', country_code: 'DE' },
        'en',
      ),
      true,
    )
  })

  it('LISTINGS_SELECT_LITE and search mapper expose geo codes', () => {
    const payload = read('lib/api/search/listing-search-payload.js')
    assert.match(payload, /country_code,\s*\n\s*region_code,\s*\n\s*city_code/)
    assert.match(payload, /export function catalogPublicGeoFields/)
    assert.match(read('lib/api/run-listings-search-get.js'), /catalogPublicGeoFields/)
    assert.match(read('lib/recommendations/serialize-recommendation-card.js'), /catalogPublicGeoFields/)
  })

  it('cards hide empty pin and do not fall back to raw OSM district', () => {
    const card = read('components/listing-card.jsx')
    assert.match(card, /locationLabel \?/)
    assert.doesNotMatch(card, /locationLabel \|\| String\(districtRaw/)
    const hook = read('lib/hooks/use-listing-location-label.js')
    assert.match(hook, /listingLocationNeedsGeoEnrichment/)
  })
})
