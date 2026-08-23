/**
 * Stage 179.0a / 179.2a / 179.1 — conditional edge Cache-Control (ADR-163 safe).
 * Run: npm run test:edge-cache
 */

const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

describe('public edge cache control (Stage 179.0a / 179.2a / 179.1)', () => {
  let mapPinsEdgeCacheControl
  let categoriesEdgeCacheControl
  let listingsSearchEdgeCacheControl
  let PRIVATE_NO_STORE_CACHE_CONTROL
  let isSimpleCatalogSearchForEdgeCache

  before(async () => {
    ;({
      mapPinsEdgeCacheControl,
      categoriesEdgeCacheControl,
      listingsSearchEdgeCacheControl,
      PRIVATE_NO_STORE_CACHE_CONTROL,
    } = await import('../lib/api/public-edge-cache-control.js'))
    ;({ isSimpleCatalogSearchForEdgeCache } = await import('../lib/api/search/params.js'))
  })

  describe('map-pins', () => {
    it('anonymous 200 → s-maxage + SWR', () => {
      const cc = mapPinsEdgeCacheControl({ viewerId: null, status: 200 })
      assert.match(cc, /^public, s-maxage=15, stale-while-revalidate=60$/)
    })

    it('logged-in 200 → private no-store (ADR-163)', () => {
      assert.equal(
        mapPinsEdgeCacheControl({ viewerId: 'user-abc', status: 200 }),
        PRIVATE_NO_STORE_CACHE_CONTROL,
      )
    })

    it('errors never edge-cache', () => {
      for (const status of [400, 429, 503, 500]) {
        assert.equal(
          mapPinsEdgeCacheControl({ viewerId: null, status }),
          PRIVATE_NO_STORE_CACHE_CONTROL,
          `status ${status}`,
        )
        assert.equal(
          mapPinsEdgeCacheControl({ viewerId: 'user-abc', status }),
          PRIVATE_NO_STORE_CACHE_CONTROL,
          `logged-in status ${status}`,
        )
      }
    })
  })

  describe('categories', () => {
    it('public guest 200 → s-maxage + SWR', () => {
      const cc = categoriesEdgeCacheControl({
        isAdminRequest: false,
        includeInactive: false,
        status: 200,
      })
      assert.match(cc, /^public, s-maxage=300, stale-while-revalidate=600$/)
    })

    it('admin or ?all=true → private no-store', () => {
      assert.equal(
        categoriesEdgeCacheControl({ isAdminRequest: true, includeInactive: false, status: 200 }),
        PRIVATE_NO_STORE_CACHE_CONTROL,
      )
      assert.equal(
        categoriesEdgeCacheControl({ isAdminRequest: false, includeInactive: true, status: 200 }),
        PRIVATE_NO_STORE_CACHE_CONTROL,
      )
    })

    it('errors never edge-cache', () => {
      assert.equal(
        categoriesEdgeCacheControl({ isAdminRequest: false, includeInactive: false, status: 500 }),
        PRIVATE_NO_STORE_CACHE_CONTROL,
      )
    })
  })

  describe('listings search (Stage 179.1)', () => {
    it('anonymous simple 200 → s-maxage=60 + SWR=120', () => {
      const cc = listingsSearchEdgeCacheControl({
        viewerId: null,
        status: 200,
        isSimpleQuery: true,
      })
      assert.match(cc, /^public, s-maxage=60, stale-while-revalidate=120$/)
    })

    it('logged-in simple 200 → private no-store (ADR-163)', () => {
      assert.equal(
        listingsSearchEdgeCacheControl({
          viewerId: 'user-abc',
          status: 200,
          isSimpleQuery: true,
        }),
        PRIVATE_NO_STORE_CACHE_CONTROL,
      )
    })

    it('filtered / dated / spatial query → no-store even when anonymous', () => {
      assert.equal(
        listingsSearchEdgeCacheControl({
          viewerId: null,
          status: 200,
          isSimpleQuery: false,
        }),
        PRIVATE_NO_STORE_CACHE_CONTROL,
      )
    })

    it('errors never edge-cache', () => {
      assert.equal(
        listingsSearchEdgeCacheControl({
          viewerId: null,
          status: 500,
          isSimpleQuery: true,
        }),
        PRIVATE_NO_STORE_CACHE_CONTROL,
      )
    })

    it('isSimpleCatalogSearchForEdgeCache allows category/where browse', () => {
      assert.equal(
        isSimpleCatalogSearchForEdgeCache({
          category: 'housing',
          where: 'phuket',
          limit: 50,
          metadataFilters: {},
        }),
        true,
      )
    })

    it('isSimpleCatalogSearchForEdgeCache rejects dates, bbox, polygon, guests>1, semantic', () => {
      assert.equal(
        isSimpleCatalogSearchForEdgeCache({
          checkIn: '2026-09-01',
          checkOut: '2026-09-05',
          metadataFilters: {},
        }),
        false,
      )
      assert.equal(
        isSimpleCatalogSearchForEdgeCache({
          mapBounds: { south: 1, north: 2, west: 3, east: 4 },
          metadataFilters: {},
        }),
        false,
      )
      assert.equal(
        isSimpleCatalogSearchForEdgeCache({
          polygon: true,
          metadataFilters: {},
        }),
        false,
      )
      assert.equal(
        isSimpleCatalogSearchForEdgeCache({
          guests: 3,
          metadataFilters: {},
        }),
        false,
      )
      assert.equal(
        isSimpleCatalogSearchForEdgeCache({
          semantic: true,
          q: 'villa',
          metadataFilters: {},
        }),
        false,
      )
    })
  })
})
