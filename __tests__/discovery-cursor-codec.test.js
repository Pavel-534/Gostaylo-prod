/**
 * Stage 177.2 — discovery cursor codec unit tests.
 * Run: npm run test:discovery-cursor
 */

const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

describe('discovery cursor codec (Stage 177.2)', () => {
  let encodeDiscoveryCursor
  let decodeDiscoveryCursor
  let isDiscoveryStableCatalogSort

  before(async () => {
    ;({
      encodeDiscoveryCursor,
      decodeDiscoveryCursor,
      isDiscoveryStableCatalogSort,
    } = await import('../lib/search/discovery-cursor-codec.js'))
  })

  it('round-trips Base64URL JSON [lastCreatedAt, lastId]', () => {
    const encoded = encodeDiscoveryCursor({
      lastCreatedAt: '2026-06-22T10:15:30.000Z',
      lastId: 'lst-villa-1773578825137',
    })
    const decoded = decodeDiscoveryCursor(encoded)
    assert.equal(decoded.ok, true)
    assert.equal(decoded.value.sortKey, 'created_at')
    assert.equal(decoded.value.lastCreatedAt, '2026-06-22T10:15:30.000Z')
    assert.equal(decoded.value.lastId, 'lst-villa-1773578825137')
  })

  it('rejects invalid Base64URL payload', () => {
    const result = decodeDiscoveryCursor('not-a-valid-cursor!!!')
    assert.equal(result.ok, false)
    assert.equal(result.issue.code, 'CURSOR_INVALID')
  })

  it('rejects JSON arrays that are not length 2', () => {
    const bad = Buffer.from(JSON.stringify(['only-one']), 'utf8').toString('base64url')
    const result = decodeDiscoveryCursor(bad)
    assert.equal(result.ok, false)
    assert.equal(result.issue.code, 'CURSOR_INVALID')
  })

  it('rejects empty listing id', () => {
    const bad = Buffer.from(JSON.stringify(['2026-06-22T10:15:30.000Z', '']), 'utf8').toString('base64url')
    const result = decodeDiscoveryCursor(bad)
    assert.equal(result.ok, false)
    assert.equal(result.issue.code, 'CURSOR_ID_INVALID')
  })

  it('isDiscoveryStableCatalogSort accepts only created_at', () => {
    assert.equal(isDiscoveryStableCatalogSort('created_at'), true)
    assert.equal(isDiscoveryStableCatalogSort('CREATED_AT'), true)
    assert.equal(isDiscoveryStableCatalogSort('recommended'), false)
    assert.equal(isDiscoveryStableCatalogSort(null), false)
  })
})
