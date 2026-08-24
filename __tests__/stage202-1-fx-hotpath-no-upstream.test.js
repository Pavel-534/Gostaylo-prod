/**
 * Stage 202.1 — guest FX path must not call ExchangeRate-API (cron is writer SSOT).
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

describe('Stage 202.1 — FX hot path no upstream', () => {
  it('getDisplayRateMap gates upstream behind allowUpstreamRefresh', () => {
    const src = read('lib/services/currency.service.js')
    assert.match(src, /allowUpstreamRefresh\s*===\s*true/)
    assert.match(src, /Stage 202\.1/)
    assert.match(src, /\[FX_STALE\]/)
    // Default path must not call fetch without the opt-in gate nearby
    const idx = src.indexOf('export async function getDisplayRateMap')
    const slice = src.slice(idx, idx + 3500)
    assert.match(slice, /allowUpstreamRefresh/)
    assert.match(slice, /fetchThbPerUnitFromExchangeRateApi/)
  })

  it('cron still owns upstream fetch', () => {
    const cron = read('lib/cron/exchange-rates-refresh.service.js')
    assert.match(cron, /fetchDisplayFxFromExchangeRateApiDetailed/)
    assert.match(cron, /upsertDisplayRatesInDb/)
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
