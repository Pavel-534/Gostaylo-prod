/**
 * Stage 202.5 — desktop catalog map soft-back camera (parity with PWA `#map` sheet).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-5-desktop-map-softback.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isStorefrontListingPdpPath } from '../lib/navigation/storefront-search-keep-alive.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.5 — desktop map soft-back camera', () => {
  it('SearchMapWrapper forwards soft-back camera props to CatalogSearchMapPanel', () => {
    const src = read('components/search/SearchMapWrapper.jsx')
    assert.match(src, /cameraRestoreBbox/)
    assert.match(src, /holdSoftBackCamera/)
    assert.match(src, /onCameraRestoreDone/)
  })

  it('CatalogSearchMapPanel persists viewport for desktop + mobile soft-back', () => {
    const src = read('components/search/CatalogSearchMapPanel.jsx')
    assert.match(src, /rememberCatalogMapViewport/)
    assert.match(src, /Stage 202\.5/)
  })

  it('desktop SearchMapWrapper uses softBack map center/zoom + restore props', () => {
    const client = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.match(client, /mapCenter=\{softBackMapCenter \|\| whereGeoView\.center\}/)
    assert.match(client, /mapZoom=\{softBackMapZoom \?\? whereGeoView\.zoom\}/)
    assert.match(client, /cameraRestoreBbox=\{cameraRestoreBbox\}/)
    assert.match(client, /holdSoftBackCamera=\{holdSoftBackCamera\}/)
  })

  it('leaving catalog to PDP does not clear session camera', () => {
    const client = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.match(client, /isStorefrontListingPdpPath\(path\)/)
    assert.match(client, /keep session camera when leaving to listing PDP/)
    assert.equal(isStorefrontListingPdpPath('/listings/abc'), true)
    assert.equal(isStorefrontListingPdpPath('/listings'), false)
  })

  it('mobile sheet still remembers viewport (PWA path unchanged)', () => {
    const sheet = read('components/search/CatalogMobileMapSheet.jsx')
    assert.match(sheet, /rememberCatalogMapViewport/)
  })
})
