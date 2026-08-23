/**
 * Stage 177.5.1 — polygon module split + desktop draw guards.
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')

describe('discovery polygon modules (Stage 177.5.1)', () => {
  it('browser helper does not import Node zlib/crypto', () => {
    const src = fs.readFileSync(path.join(root, 'lib/search/discovery-geo-polygon-browser.js'), 'utf8')
    assert.doesNotMatch(src, /from ['"]zlib['"]/)
    assert.doesNotMatch(src, /from ['"]crypto['"]/)
    assert.doesNotMatch(src, /from ['"]node:/)
    assert.match(src, /CompressionStream/)
    assert.match(src, /discovery-geo-polygon-core/)
  })

  it('MapPolygonDrawChrome uses browser encode, not Node polygon module', () => {
    const src = fs.readFileSync(
      path.join(root, 'components/search/MapPolygonDrawChrome.jsx'),
      'utf8',
    )
    assert.match(src, /discovery-geo-polygon-browser/)
    assert.doesNotMatch(src, /from ['"]@\/lib\/search\/discovery-geo-polygon['"]/)
    assert.match(src, /@geoman-io\/leaflet-geoman-free/)
  })

  it('CatalogMobileMapSheet path forces enablePolygonDraw false from catalog props', () => {
    const src = fs.readFileSync(
      path.join(root, 'app/(storefront)/listings/listings-catalog-client.jsx'),
      'utf8',
    )
    assert.match(src, /enablePolygonDraw:\s*false/)
    assert.match(src, /enablePolygonDraw=\{polygonDrawEnabled\}/)
  })

  it('core validate rejects oversized rings', async () => {
    const { validatePolygonGeoJson } = await import('../lib/search/discovery-geo-polygon-core.js')
    const ring = []
    for (let i = 0; i < 510; i++) ring.push([98.3 + i * 0.00001, 7.9])
    ring.push(ring[0])
    const result = validatePolygonGeoJson({ type: 'Polygon', coordinates: [ring] })
    assert.equal(result.ok, false)
    assert.equal(result.code, 'POLYGON_TOO_MANY_VERTICES')
  })
})
