/**
 * Stage 201.112 — FX cron skip window + no empty upsert on upstream failure.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-112-exchange-rates-cron.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('path')

const root = path.join(__dirname, '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.112 — cron skip window', () => {
  it('skips when all display codes are younger than 4h', async () => {
    const { shouldSkipExchangeRatesCronRefresh } = await import(
      '@/lib/cron/exchange-rates-refresh.service.js'
    )
    const now = Date.now()
    const iso = new Date(now - 60 * 60 * 1000).toISOString()
    const rows = ['USD', 'EUR', 'GBP', 'RUB', 'CNY', 'USDT'].map((currency_code) => ({
      currency_code,
      rate_to_thb: 1.2,
      updated_at: iso,
    }))
    assert.equal(shouldSkipExchangeRatesCronRefresh(rows, now), true)
  })

  it('does not skip when any display code is older than 4h or missing', async () => {
    const { shouldSkipExchangeRatesCronRefresh } = await import(
      '@/lib/cron/exchange-rates-refresh.service.js'
    )
    const now = Date.now()
    const fresh = new Date(now - 60 * 60 * 1000).toISOString()
    const stale = new Date(now - 5 * 60 * 60 * 1000).toISOString()
    const base = ['USD', 'EUR', 'GBP', 'RUB', 'CNY'].map((currency_code) => ({
      currency_code,
      rate_to_thb: 30,
      updated_at: fresh,
    }))
    assert.equal(
      shouldSkipExchangeRatesCronRefresh(
        [...base, { currency_code: 'USDT', rate_to_thb: 32, updated_at: stale }],
        now,
      ),
      false,
    )
    assert.equal(shouldSkipExchangeRatesCronRefresh(base, now), false)
  })
})

describe('Stage 201.112 — route + persist guards', () => {
  it('cron route requires CRON_SECRET and uses skip/keptExisting contract', () => {
    const route = read('app/api/cron/exchange-rates-refresh/route.js')
    assert.match(route, /assertCronAuthorized/)
    assert.match(route, /runExchangeRatesCronRefresh/)
    assert.match(route, /httpStatusForExchangeRatesCronResult/)
    assert.doesNotMatch(route, /getDisplayRateMap/)
    const svc = read('lib/cron/exchange-rates-refresh.service.js')
    assert.match(svc, /Skipped, updated recently/)
    assert.match(svc, /keptExisting: true/)
    assert.match(svc, /upsertDisplayRatesInDb/)
    assert.match(svc, /httpStatusForExchangeRatesCronResult/)
  })

  it('upsert skips non-positive / empty maps (no wipe)', () => {
    const src = read('lib/services/currency.service.js')
    assert.match(src, /export async function upsertDisplayRatesInDb/)
    assert.match(src, /if \(raw == null \|\| !Number\.isFinite\(raw\) \|\| raw <= 0\) continue/)
    assert.match(src, /if \(!rows\.length\) return/)
    assert.match(src, /if \(!res\.ok\)/)
    assert.match(src, /return \{ ok: false, map: null, httpStatus: res\.status/)
    assert.match(src, /markFxUpstreamRateLimited/)
  })
})

describe('Stage 201.113 — soft HTTP for keptExisting + 429 cooldown', () => {
  it('httpStatusForExchangeRatesCronResult is 200 when rates kept', async () => {
    const { httpStatusForExchangeRatesCronResult } = await import(
      '@/lib/cron/exchange-rates-refresh.service.js'
    )
    assert.equal(
      httpStatusForExchangeRatesCronResult({
        success: true,
        keptExisting: true,
        httpStatus: 429,
        error: 'HTTP_429',
      }),
      200,
    )
    assert.equal(
      httpStatusForExchangeRatesCronResult({
        success: false,
        httpStatus: 503,
        error: 'SERVICE_UNAVAILABLE',
      }),
      503,
    )
  })

  it('fx upstream cooldown gates after mark', async () => {
    const {
      isFxUpstreamInCooldown,
      markFxUpstreamRateLimited,
      resetFxUpstreamCooldownForTests,
      fxUpstreamCooldownRemainingMs,
    } = await import('@/lib/services/fx-upstream-cooldown.js')
    resetFxUpstreamCooldownForTests()
    assert.equal(isFxUpstreamInCooldown(1_000), false)
    markFxUpstreamRateLimited(1_000)
    assert.equal(isFxUpstreamInCooldown(1_000 + 60_000), true)
    assert.ok(fxUpstreamCooldownRemainingMs(1_000 + 60_000) > 0)
    resetFxUpstreamCooldownForTests()
  })
})
