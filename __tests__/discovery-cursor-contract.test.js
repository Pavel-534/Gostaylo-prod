/**
 * Stage 177.2 — discovery cursor contract + plan unit tests.
 * Run: npm run test:discovery-cursor
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

describe('discovery cursor contract & plan (Stage 177.2)', () => {
  let parseDiscoveryFiltersFromSearchParams
  let buildDiscoveryQueryPlan
  let encodeDiscoveryCursor
  let DISCOVERY_STABLE_CATALOG_ORDER_BY

  const prevFlag = process.env.DISCOVERY_UNIFIED_PIPELINE

  before(async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    ;({ parseDiscoveryFiltersFromSearchParams } = await import(
      '../lib/search/discovery-filter-contract.js'
    ))
    ;({ buildDiscoveryQueryPlan, DISCOVERY_STABLE_CATALOG_ORDER_BY } = await import(
      '../lib/search/discovery-query-plan.js'
    ))
    ;({ encodeDiscoveryCursor } = await import('../lib/search/discovery-cursor-codec.js'))
  })

  after(() => {
    if (prevFlag === undefined) {
      delete process.env.DISCOVERY_UNIFIED_PIPELINE
    } else {
      process.env.DISCOVERY_UNIFIED_PIPELINE = prevFlag
    }
  })

  it('unified catalog defaults limit to 24', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(new URLSearchParams('sort=created_at'), {
      surface: 'catalog',
    })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.browse.limit, 24)
  })

  it('unified catalog rejects limit above 50', async () => {
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams('limit=51&sort=created_at'),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'LIMIT_OUT_OF_RANGE'))
  })

  it('rejects cursor when sort is not created_at', async () => {
    const cursor = encodeDiscoveryCursor({
      lastCreatedAt: '2026-06-22T10:15:30.000Z',
      lastId: 'lst-abc',
    })
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(`cursor=${encodeURIComponent(cursor)}&sort=recommended`),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => i.code === 'CURSOR_SORT_NOT_SUPPORTED'))
  })

  it('accepts cursor with stable sort=created_at', async () => {
    const cursor = encodeDiscoveryCursor({
      lastCreatedAt: '2026-06-22T10:15:30.000Z',
      lastId: 'lst-abc',
    })
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(`cursor=${encodeURIComponent(cursor)}&sort=created_at&limit=24`),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.browse.cursor.lastId, 'lst-abc')
  })

  it('buildDiscoveryQueryPlan fills cursor pagination fields', async () => {
    const cursor = encodeDiscoveryCursor({
      lastCreatedAt: '2026-06-22T10:15:30.000Z',
      lastId: 'lst-abc',
    })
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(`cursor=${encodeURIComponent(cursor)}&sort=created_at&limit=30`),
      { surface: 'catalog' },
    )
    assert.equal(parsed.ok, true)
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'catalog' })
    assert.equal(plan.sql.paginationMode, 'cursor')
    assert.equal(plan.sql.pageSize, 30)
    assert.equal(plan.sql.overFetch, 1)
    assert.deepEqual(plan.sql.orderBy, DISCOVERY_STABLE_CATALOG_ORDER_BY)
    assert.equal(plan.sql.cursor.lastId, 'lst-abc')
  })

  it('map surface plan ignores cursor pagination mode', async () => {
    const cursor = encodeDiscoveryCursor({
      lastCreatedAt: '2026-06-22T10:15:30.000Z',
      lastId: 'lst-abc',
    })
    const parsed = await parseDiscoveryFiltersFromSearchParams(
      new URLSearchParams(`cursor=${encodeURIComponent(cursor)}&sort=created_at`),
      { surface: 'map' },
    )
    assert.equal(parsed.ok, true)
    const plan = await buildDiscoveryQueryPlan(parsed.value, { surface: 'map' })
    assert.equal(plan.sql.paginationMode, 'fetch_limit')
    assert.equal(plan.sql.cursor, null)
  })
})
