/**
 * Stage 202.1 / 202.3 — guest FX path must not call ExchangeRate-API (cron is writer SSOT).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-1-fx-hotpath-no-upstream.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 202.1 / 202.3 — FX hot path no upstream', () => {
  it('getDisplayRateMap gates upstream behind allowUpstreamRefresh', () => {
    const src = read('lib/services/currency.service.js')
    assert.match(src, /allowUpstreamRefresh\s*===\s*true/)
    assert.match(src, /Stage 202\.1/)
    assert.match(src, /\[FX_STALE\]/)
    const idx = src.indexOf('export async function getDisplayRateMap')
    const slice = src.slice(idx, idx + 3500)
    assert.match(slice, /allowUpstreamRefresh/)
    assert.match(slice, /fetchThbPerUnitFromExchangeRateApi/)
    assert.doesNotMatch(slice, /maybeAlertStaleDisplayRates\(/)
  })

  it('resolveThbPerUsdt does not call ExchangeRate-API', () => {
    const src = read('lib/services/currency.service.js')
    const start = src.indexOf('export async function resolveThbPerUsdt')
    const end = src.indexOf('export async function getExpectedUsdtForBooking')
    const slice = src.slice(start, end > start ? end : start + 2000)
    assert.doesNotMatch(slice, /v6\.exchangerate-api\.com/)
    assert.match(slice, /Stage 202\.3/)
  })

  it('cron owns upstream fetch + stale TG', () => {
    const cron = read('lib/cron/exchange-rates-refresh.service.js')
    assert.match(cron, /fetchDisplayFxFromExchangeRateApiDetailed/)
    assert.match(cron, /upsertDisplayRatesInDb/)
    const route = read('app/api/cron/exchange-rates-refresh/route.js')
    assert.match(route, /maybeAlertStaleDisplayRatesFromHealth/)
    assert.match(route, /getDisplayFxStaleHealthFromDb/)
  })

  it('FX stale alerts classify as FX (hourly guard)', async () => {
    const { classifySystemAlert } = await import('../lib/services/system-alert-notify.js')
    assert.equal(
      classifySystemAlert('[FX_STALE] Курсы валют устарели! USD, EUR'),
      'FX',
    )
    assert.equal(
      classifySystemAlert('⚠️ КРИТИЧНО: Курсы валют устарели!'),
      'FX',
    )
  })
})
