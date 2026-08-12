/**
 * Stage 200.125 — season-type helpers stay browser-safe (wizard / seasonal UI).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-125-season-type-browser-safe.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeSeasonType, SEASON_TYPE_VALUES } from '@/lib/listing/season-type.js'

const root = process.cwd()

describe('Stage 200.125 — season-type browser-safe', () => {
  it('season-type module has no server/FX imports', () => {
    const src = readFileSync(join(root, 'lib/listing/season-type.js'), 'utf8')
    assert.doesNotMatch(src, /from ['"]node:|currency\.service|pricing-fx-helpers|request-correlation/)
    assert.deepEqual([...SEASON_TYPE_VALUES], ['LOW', 'NORMAL', 'HIGH', 'PEAK'])
    assert.equal(normalizeSeasonType('high'), 'HIGH')
    assert.equal(normalizeSeasonType('BASE'), 'NORMAL')
  })

  it('client seasonal UI imports season-type, not full seasonal canon', () => {
    const mgr = readFileSync(join(root, 'components/seasonal-price-manager.js'), 'utf8')
    const load = readFileSync(
      join(root, 'app/(partner)/partner/listings/new/hooks/listing-wizard-load-existing.js'),
      'utf8',
    )
    assert.ok(mgr.includes("from '@/lib/listing/season-type'"))
    assert.doesNotMatch(mgr, /listing-seasonal-price-canon/)
    assert.ok(load.includes("from '@/lib/listing/season-type'"))
    assert.doesNotMatch(load, /listing-seasonal-price-canon/)
  })

  it('listing-seasonal-price-canon re-exports season-type for server callers', () => {
    const src = readFileSync(join(root, 'lib/listing/listing-seasonal-price-canon.js'), 'utf8')
    assert.ok(src.includes("from '@/lib/listing/season-type.js'"))
    assert.ok(src.includes('export { normalizeSeasonType, SEASON_TYPE_VALUES }'))
  })
})
