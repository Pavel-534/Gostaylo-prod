/**
 * Stage 201.89 — thinner pin ring; soft-back without #map gate; PDP flow hint removed.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-89-map-softback-pin-ring.test.js
 */
import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  clearCatalogMapViewport,
  normalizeCatalogMapViewport,
  peekCatalogMapViewport,
  rememberCatalogMapViewport,
} from '../lib/navigation/catalog-map-viewport-memory.js'
import {
  captureCatalogReturnBeforePdp,
  peekCatalogReturnHref,
} from '../lib/navigation/catalog-return-href.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

function mockWindow({ pathname, search = '', hash = '', seed = null }) {
  const m = new Map()
  if (seed && typeof seed === 'object') {
    for (const [k, v] of Object.entries(seed)) m.set(k, String(v))
  }
  const loc = {
    pathname,
    search,
    hash,
    href: `https://airento.local${pathname}${search}${hash}`,
  }
  globalThis.window = {
    location: loc,
    sessionStorage: {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    },
    history: {
      state: null,
      replaceState(_s, _t, url) {
        const u = new URL(String(url), 'https://airento.local')
        loc.pathname = u.pathname
        loc.search = u.search
        loc.hash = u.hash
        loc.href = u.href
      },
    },
  }
}

describe('Stage 201.89 — map soft-back + pin ring + PDP declutter', () => {
  beforeEach(() => {
    mockWindow({ pathname: '/listings', search: '', hash: '' })
    clearCatalogMapViewport()
  })

  it('selected pin ring is ~1.5px (not 3px) in CSS + marker', () => {
    const css = read('app/globals.css')
    assert.match(css, /gostaylo-price-pill--selected[\s\S]*?0 0 0 1\.5px #006666/)
    assert.doesNotMatch(
      css,
      /gostaylo-price-pill--selected[\s\S]*?0 0 0 3px #006666/,
    )
    const marker = read('components/listing/ListingPriceMarker.jsx')
    assert.match(marker, /0 0 0 1\.5px #006666/)
    assert.doesNotMatch(marker, /0 0 0 3px #006666/)
  })

  it('popup ignores programmatic popupclose so selection/ring stays', () => {
    const popup = read('components/listing/CatalogMapSelectedPopup.jsx')
    assert.match(popup, /ignorePopupCloseRef/)
    assert.match(popup, /if \(ignorePopupCloseRef\.current\) return/)
  })

  it('selected pin rendered outside MarkerClusterGroup', () => {
    const map = read('components/listing/InteractiveSearchMap.jsx')
    assert.match(map, /keep selected pin outside cluster/)
    assert.match(map, /selectedPopupPin[\s\S]*?zIndexOffset: 2500/)
  })

  it('catalog soft-back init does not require #map to read viewport', () => {
    const client = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.match(client, /soft-back camera from session even if App Router dropped/)
    assert.doesNotMatch(
      client,
      /if \(!readCatalogMobileMapOpenFromLocation\(\)\) return null/,
    )
    assert.match(client, /holdSoftBackCameraRef/)
  })

  it('useSoftBack re-applies #map after replace', () => {
    const soft = read('hooks/use-soft-back.js')
    assert.match(soft, /ensureCatalogMapHashAfterSoftBack/)
    assert.match(soft, /writeCatalogMobileMapHash\(true\)/)
  })

  it('PDP no longer mounts GuestBookingFlowHint above fold', () => {
    const pdp = read('app/(storefront)/listings/[id]/ListingPdpClient.jsx')
    assert.doesNotMatch(pdp, /GuestBookingFlowHint/)
  })

  it('viewport without hash still captured for return + #map forced', () => {
    mockWindow({
      pathname: '/listings',
      hash: '',
      seed: {
        'airento:catalog-map-viewport-v1': JSON.stringify({
          south: 7.8,
          north: 8.1,
          west: 98.2,
          east: 98.5,
          centerLat: 7.95,
          centerLng: 98.35,
          zoom: 13,
          selectedListingId: 'lst-phuket',
        }),
      },
    })
    const snap = peekCatalogMapViewport()
    assert.equal(snap?.zoom, 13)
    assert.equal(snap?.selectedListingId, 'lst-phuket')
    captureCatalogReturnBeforePdp()
    assert.match(String(peekCatalogReturnHref() || ''), /#map/)
    assert.ok(peekCatalogMapViewport())
  })

  it('normalize keeps center+zoom for exact soft-back camera', () => {
    const n = normalizeCatalogMapViewport({
      south: 7.8,
      north: 8.1,
      west: 98.2,
      east: 98.5,
      centerLat: 7.9,
      centerLng: 98.3,
      zoom: 14,
    })
    assert.equal(n?.zoom, 14)
    rememberCatalogMapViewport(n)
    assert.equal(peekCatalogMapViewport()?.zoom, 14)
  })
})
