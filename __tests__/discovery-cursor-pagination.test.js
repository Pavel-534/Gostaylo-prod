/**
 * Stage 177.2 — cursor SQL helper + executor slice unit tests.
 * Run: npm run test:discovery-cursor
 */

const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

const STABLE_ORDER = [
  { column: 'created_at', ascending: false },
  { column: 'id', ascending: false },
]

function createMockQuery() {
  const calls = []
  const chain = {
    or(filter) {
      calls.push(['or', filter])
      return chain
    },
    order(column, opts) {
      calls.push(['order', column, opts])
      return chain
    },
    limit(n) {
      calls.push(['limit', n])
      return chain
    },
    getCalls() {
      return calls
    },
  }
  return chain
}

describe('discovery cursor pagination (Stage 177.2 E3)', () => {
  let buildDiscoveryKeysetOrFilter
  let applyDiscoveryCursorToQuery
  let discoveryCursorFetchLimit
  let slicePageAndBuildNextCursor
  let encodeDiscoveryCursor
  let decodeDiscoveryCursor

  before(async () => {
    ;({
      buildDiscoveryKeysetOrFilter,
      applyDiscoveryCursorToQuery,
      discoveryCursorFetchLimit,
    } = await import('../lib/api/search/discovery-cursor-sql.js'))
    ;({ slicePageAndBuildNextCursor } = await import('../lib/search/discovery-cursor-page.js'))
    ;({ encodeDiscoveryCursor, decodeDiscoveryCursor } = await import(
      '../lib/search/discovery-cursor-codec.js'
    ))
  })

  it('buildDiscoveryKeysetOrFilter returns null on first page', () => {
    assert.equal(buildDiscoveryKeysetOrFilter(null, STABLE_ORDER), null)
  })

  it('buildDiscoveryKeysetOrFilter builds DESC keyset or-clause', () => {
    const filter = buildDiscoveryKeysetOrFilter(
      { sortKey: 'created_at', lastCreatedAt: '2026-06-22T10:00:00.000Z', lastId: 'lst-abc' },
      STABLE_ORDER,
    )
    assert.match(
      filter,
      /created_at\.lt\.("2026-06-22T10:00:00\.000Z"|2026-06-22T10:00:00\.000Z),and\(created_at\.eq\..+,id\.lt\.lst-abc\)/,
    )
  })

  it('applyDiscoveryCursorToQuery sets order, limit pageSize+1, and keyset or on follow-up', () => {
    const firstPageQuery = createMockQuery()
    applyDiscoveryCursorToQuery(firstPageQuery, null, STABLE_ORDER, 24, 1)
    assert.deepEqual(firstPageQuery.getCalls(), [
      ['order', 'created_at', { ascending: false }],
      ['order', 'id', { ascending: false }],
      ['limit', 25],
    ])

    const followUpQuery = createMockQuery()
    applyDiscoveryCursorToQuery(
      followUpQuery,
      { sortKey: 'created_at', lastCreatedAt: '2026-06-22T10:00:00.000Z', lastId: 'lst-abc' },
      STABLE_ORDER,
      24,
      1,
    )
    const calls = followUpQuery.getCalls()
    assert.equal(calls[0][0], 'or')
    assert.equal(calls.at(-1)[0], 'limit')
    assert.equal(calls.at(-1)[1], discoveryCursorFetchLimit(24, 1))
  })

  it('slicePageAndBuildNextCursor — first page with more results', () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: `lst-${i}`,
      created_at: `2026-06-22T10:${String(i).padStart(2, '0')}:00.000Z`,
    }))
    const result = slicePageAndBuildNextCursor(rows, 24)
    assert.equal(result.pageRows.length, 24)
    assert.equal(result.hasMore, true)
    assert.ok(result.nextCursor)
    const decoded = decodeDiscoveryCursor(result.nextCursor)
    assert.equal(decoded.ok, true)
    assert.equal(decoded.value.lastId, 'lst-23')
  })

  it('slicePageAndBuildNextCursor — intermediate page via encoded cursor', () => {
    const cursor = encodeDiscoveryCursor({
      lastCreatedAt: '2026-06-22T09:00:00.000Z',
      lastId: 'lst-page-1-last',
    })
    const decoded = decodeDiscoveryCursor(cursor)
    assert.equal(decoded.ok, true)

    const rows = Array.from({ length: 25 }, (_, i) => ({
      id: `lst-page-2-${i}`,
      created_at: `2026-06-22T08:${String(i).padStart(2, '0')}:00.000Z`,
    }))
    const result = slicePageAndBuildNextCursor(rows, 24)
    assert.equal(result.pageRows.length, 24)
    assert.ok(result.nextCursor)
    assert.notEqual(result.nextCursor, cursor)
  })

  it('slicePageAndBuildNextCursor — last page (no over-fetch row)', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `lst-last-${i}`,
      created_at: `2026-06-22T07:${String(i).padStart(2, '0')}:00.000Z`,
    }))
    const result = slicePageAndBuildNextCursor(rows, 24)
    assert.equal(result.pageRows.length, 10)
    assert.equal(result.nextCursor, null)
    assert.equal(result.hasMore, false)
  })

  it('slicePageAndBuildNextCursor — empty result', () => {
    const result = slicePageAndBuildNextCursor([], 24)
    assert.deepEqual(result, { pageRows: [], nextCursor: null, hasMore: false })
  })
})
