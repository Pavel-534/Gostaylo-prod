/**
 * Stage 200.35 — GeoService pure helpers + currency fallback (no live Nominatim).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-35-geo-foundation.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('Stage 200.35 geo foundation', () => {
  it('hashKey is stable for reverse coords', async () => {
    const { GeoService } = await import('../lib/services/geo/geo.service.js')
    const a = GeoService._hashKey('reverse', '55.75580,37.61730')
    const b = GeoService._hashKey('reverse', '55.75580,37.61730')
    const c = GeoService._hashKey('reverse', '55.75581,37.61730')
    assert.equal(a, b)
    assert.notEqual(a, c)
    assert.equal(a.length, 64)
  })

  it('slugifyCode normalizes city names', async () => {
    const { GeoService } = await import('../lib/services/geo/geo.service.js')
    assert.equal(GeoService._slugifyCode('Saint Petersburg'), 'saint-petersburg')
    assert.match(GeoService._slugifyCode('Новосибирск'), /^[a-z0-9-]*$/)
  })

  it('launch seed includes new RU hubs without dropping TH/RU presets', async () => {
    const { LAUNCH_GEO_SEED } = await import('../lib/geo/launch-markets-seed-data.js')
    const codes = new Set(LAUNCH_GEO_SEED.map((n) => n.code))
    for (const c of [
      'TH',
      'RU',
      'phuket-city',
      'moscow',
      'novosibirsk',
      'yekaterinburg',
      'vladivostok',
      'dubai',
    ]) {
      assert.equal(codes.has(c), true, `missing ${c}`)
    }
    const ns = LAUNCH_GEO_SEED.find((n) => n.code === 'novosibirsk')
    assert.equal(ns.parent_code, 'RU-NVS')
    assert.equal(ns.timezone, 'Asia/Novosibirsk')
  })

  it('country currency/tz fallback table matches ADR-181 launch map', async () => {
    const { COUNTRY_CURRENCY_TZ } = await import('../lib/geo/launch-markets-seed-data.js')
    assert.deepEqual(COUNTRY_CURRENCY_TZ.RU, { currency: 'RUB', timezone: 'Europe/Moscow' })
    assert.deepEqual(COUNTRY_CURRENCY_TZ.TH, { currency: 'THB', timezone: 'Asia/Bangkok' })
  })

  it('getCurrencyAndTimezone falls back without DB', async () => {
    const { GeoService } = await import('../lib/services/geo/geo.service.js')
    const ct = await GeoService.getCurrencyAndTimezone('RU')
    assert.equal(ct.currency, 'RUB')
    assert.ok(ct.timezone)
  })
})
