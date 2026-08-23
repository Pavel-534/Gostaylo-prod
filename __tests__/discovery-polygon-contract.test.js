/**
 * Stage 177.5.0 — polygon GeoJSON encode/decode + registry precedence.
 * Run: npm run test:discovery-pipeline (includes this file via package script update)
 * Or: node --import ./scripts/node-test-alias-register.mjs --test __tests__/discovery-polygon-contract.test.js
 */

const { describe, it, before, after } = require('node:test')
const assert = require('node:assert/strict')

/** Small Phuket-ish rectangle (~1 km²), closed ring, RFC 7946 [lng, lat]. */
const SAMPLE_POLYGON = {
  type: 'Polygon',
  coordinates: [
    [
      [98.30, 7.90],
      [98.31, 7.90],
      [98.31, 7.91],
      [98.30, 7.91],
      [98.30, 7.90],
    ],
  ],
}

describe('discovery polygon contract (Stage 177.5.0)', () => {
  let encodePolygonSearchParam
  let decodePolygonSearchParam
  let validatePolygonGeoJson
  let parseDiscoveryFiltersFromSearchParams
  let buildDiscoveryQueryPlan
  let diffDiscoveryPlansForSurfaces
  let ORDERED_FILTER_KEYS
  let isDiscoveryPolygonSearchEnabled

  const prevUnified = process.env.DISCOVERY_UNIFIED_PIPELINE
  const prevPoly = process.env.DISCOVERY_POLYGON_SEARCH

  before(async () => {
    ;({
      encodePolygonSearchParam,
      decodePolygonSearchParam,
      validatePolygonGeoJson,
    } = await import('../lib/search/discovery-geo-polygon.js'))
    ;({
      parseDiscoveryFiltersFromSearchParams,
    } = await import('../lib/search/discovery-filter-contract.js'))
    ;({
      buildDiscoveryQueryPlan,
      diffDiscoveryPlansForSurfaces,
    } = await import('../lib/search/discovery-query-plan.js'))
    ;({
      ORDERED_FILTER_KEYS,
    } = await import('../lib/search/filter-registry.js'))
    ;({
      isDiscoveryPolygonSearchEnabled,
    } = await import('../lib/search/discovery-pipeline-flag.js'))
  })

  after(() => {
    if (prevUnified === undefined) delete process.env.DISCOVERY_UNIFIED_PIPELINE
    else process.env.DISCOVERY_UNIFIED_PIPELINE = prevUnified
    if (prevPoly === undefined) delete process.env.DISCOVERY_POLYGON_SEARCH
    else process.env.DISCOVERY_POLYGON_SEARCH = prevPoly
  })

  it('ORDERED_FILTER_KEYS places geo.polygon after geo.bbox', () => {
    const idxBbox = ORDERED_FILTER_KEYS.indexOf('geo.bbox')
    const idxPoly = ORDERED_FILTER_KEYS.indexOf('geo.polygon')
    assert.ok(idxBbox >= 0)
    assert.ok(idxPoly === idxBbox + 1)
  })

  it('gzip+base64url round-trip', () => {
    const encoded = encodePolygonSearchParam(SAMPLE_POLYGON)
    assert.equal(encoded.includes('{'), false)
    const decoded = decodePolygonSearchParam(encoded)
    assert.equal(decoded.ok, true)
    assert.equal(decoded.geojson.type, 'Polygon')
    assert.deepEqual(decoded.geojson.coordinates[0][0], [98.30, 7.90])
  })

  it('rejects too many vertices', () => {
    const ring = []
    for (let i = 0; i < 510; i++) {
      ring.push([98.3 + i * 0.00001, 7.9])
    }
    ring.push(ring[0])
    const result = validatePolygonGeoJson({ type: 'Polygon', coordinates: [ring] })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'POLYGON_TOO_MANY_VERTICES')
  })

  it('polygon flag defaults off — URL param ignored', async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    delete process.env.DISCOVERY_POLYGON_SEARCH
    assert.equal(isDiscoveryPolygonSearchEnabled(), false)

    const encoded = encodePolygonSearchParam(SAMPLE_POLYGON)
    const sp = new URLSearchParams(
      `category=stays&south=7.7&north=8.2&west=98.2&east=98.5&polygon=${encoded}`,
    )
    const parsed = await parseDiscoveryFiltersFromSearchParams(sp, { surface: 'catalog' })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.geo.mode, 'bbox')
  })

  it('with flags on — polygon wins over bbox and plans catalog/map parity', async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    process.env.DISCOVERY_POLYGON_SEARCH = '1'
    assert.equal(isDiscoveryPolygonSearchEnabled(), true)

    const encoded = encodePolygonSearchParam(SAMPLE_POLYGON)
    const sp = new URLSearchParams(
      `category=stays&south=7.7&north=8.2&west=98.2&east=98.5&polygon=${encodeURIComponent(encoded)}`,
    )
    const parsed = await parseDiscoveryFiltersFromSearchParams(sp, { surface: 'catalog' })
    assert.equal(parsed.ok, true)
    assert.equal(parsed.value.geo.mode, 'polygon')

    const contract = { ...parsed.value, categoryIds: ['cat_poly_test'] }
    const plan = await buildDiscoveryQueryPlan(contract, { surface: 'catalog' })
    assert.ok(plan.registryFiltersApplied.includes('geo.polygon'))
    assert.ok(!plan.registryFiltersApplied.includes('geo.bbox'))
    assert.equal(plan.spatial.rpc, 'listings_within_polygon_v1')
    assert.ok(plan.spatial.rpcArgs.geojson)

    const { diff } = await diffDiscoveryPlansForSurfaces(contract)
    assert.equal(diff, null)
  })

  it('invalid polygon returns POLYGON_* validation issue', async () => {
    process.env.DISCOVERY_UNIFIED_PIPELINE = '1'
    process.env.DISCOVERY_POLYGON_SEARCH = '1'
    const sp = new URLSearchParams('polygon=not-valid-gzip')
    const parsed = await parseDiscoveryFiltersFromSearchParams(sp, { surface: 'catalog' })
    assert.equal(parsed.ok, false)
    assert.ok(parsed.issues.some((i) => String(i.code).startsWith('POLYGON_')))
  })
})
