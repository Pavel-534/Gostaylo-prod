/**
 * Stage 201.95 — launch neighborhoods + coord snap (no Nominatim on catalog read).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-95-geo-coord-snap.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('path')

const root = path.join(__dirname, '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.95 — Phuket neighborhoods in seed', () => {
  it('includes Kata / Kamala and does not treat Phuket Town as a duplicate city', async () => {
    const { resetLaunchGeoIndexForTests, findLaunchGeoByCode } = await import(
      '@/lib/geo/launch-geo-index.js'
    )
    resetLaunchGeoIndexForTests()
    const kata = findLaunchGeoByCode('kata')
    const kamala = findLaunchGeoByCode('kamala')
    assert.equal(kata?.level, 'neighborhood')
    assert.equal(kata?.parent_code, 'phuket-city')
    assert.equal(kamala?.level, 'neighborhood')
  })
})

describe('Stage 201.95 — coord snap SSOT', () => {
  it('Chita coords without codes resolve to Чита, Россия', async () => {
    const { formatListingLocationLineSync } = await import('@/lib/locations/geo-display-label.js')
    const line = formatListingLocationLineSync(
      { latitude: 52.0333, longitude: 113.5007, district: '' },
      'ru',
    )
    assert.match(line, /Чита/)
    assert.match(line, /Россия/)
  })

  it('Kata coords + Ban Kata Kiri localize on RU without dumping the OSM village string', async () => {
    const { formatListingLocationLineSync } = await import('@/lib/locations/geo-display-label.js')
    const line = formatListingLocationLineSync(
      {
        district: 'Ban Kata Kiri',
        latitude: 7.821,
        longitude: 98.2988,
      },
      'ru',
    )
    assert.match(line, /Ката/)
    assert.match(line, /Пхукет/)
    assert.match(line, /Таиланд/)
    assert.doesNotMatch(line, /Ban Kata/i)
  })

  it('Berlin coords never become Phuket', async () => {
    const { matchLaunchGeoByCoords } = await import('@/lib/geo/launch-geo-index.js')
    const { formatListingLocationLineSync } = await import('@/lib/locations/geo-display-label.js')
    assert.equal(matchLaunchGeoByCoords(52.52, 13.405), null)
    const line = formatListingLocationLineSync(
      {
        country_code: 'DE',
        district: 'Mitte',
        metadata: { city_label: 'Berlin' },
        latitude: 52.52,
        longitude: 13.405,
      },
      'en',
    )
    assert.match(line, /Berlin/)
    assert.doesNotMatch(line, /Phuket/i)
  })

  it('legacy infer fills chita from coords (backfill / save without cascade)', async () => {
    const { inferGeoFromLegacyRow } = await import('@/lib/locations/resolve-listing-geo-snapshot.js')
    const snap = inferGeoFromLegacyRow({
      latitude: 52.0333,
      longitude: 113.5007,
      district: '',
      metadata: {},
    })
    assert.equal(snap.city_code, 'chita')
    assert.equal(snap.country_code, 'RU')
    assert.equal(snap.region_code, 'RU-ZAB')
  })

  it('write snapshot fills phuket-city from Kata pin when city code is missing', async () => {
    const { resolveListingGeoSnapshot } = await import(
      '@/lib/locations/resolve-listing-geo-snapshot.js'
    )
    const snap = resolveListingGeoSnapshot({
      countryCode: 'TH',
      latitude: 7.821,
      longitude: 98.2988,
      district: '',
    })
    assert.equal(snap.city_code, 'phuket-city')
    assert.equal(snap.district, 'Kata')
  })
})

describe('Stage 201.95 — remaining surfaces use display SSOT', () => {
  it('chat / context / calendar do not dump listing.district', () => {
    assert.doesNotMatch(read('components/listing-context-card.js'), /listing\.district/)
    assert.doesNotMatch(read('components/sticky-chat-header.jsx'), /listing\?\.district/)
    assert.doesNotMatch(read('components/chat/DealDetailsCard.jsx'), /listing\?\.district/)
    assert.match(read('components/calendar/CalendarGrid.jsx'), /formatListingLocationLineSync/)
    assert.match(read('lib/geo/launch-geo-index.js'), /export function matchLaunchGeoByCoords/)
  })
})
