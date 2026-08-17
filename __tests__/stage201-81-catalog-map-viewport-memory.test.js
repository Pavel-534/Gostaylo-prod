/**
 * Stage 201.81 / 201.84 — catalog map viewport memory for soft-back.
 */
import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  clearCatalogMapViewport,
  normalizeCatalogMapViewport,
  peekCatalogMapViewport,
  rememberCatalogMapViewport,
  consumeCatalogMapViewport,
} from '../lib/navigation/catalog-map-viewport-memory.js'
import {
  captureCatalogReturnBeforePdp,
  peekCatalogReturnHref,
} from '../lib/navigation/catalog-return-href.js'

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

describe('Stage 201.81/201.84 catalog map viewport memory', () => {
  beforeEach(() => {
    mockWindow({ pathname: '/listings', search: '', hash: '#map' })
  })

  it('normalizes and remembers bbox + camera', () => {
    assert.equal(normalizeCatalogMapViewport({ south: 8, north: 7, west: 1, east: 2 }), null)
    rememberCatalogMapViewport({
      south: 7.8,
      north: 8.1,
      west: 98.2,
      east: 98.5,
      centerLat: 7.9,
      centerLng: 98.3,
      zoom: 13,
      selectedListingId: 'lst-1',
    })
    const peeked = peekCatalogMapViewport()
    assert.equal(peeked?.selectedListingId, 'lst-1')
    assert.equal(peeked?.south, 7.8)
    assert.equal(peeked?.zoom, 13)
  })

  it('consume is one-shot', () => {
    rememberCatalogMapViewport({
      south: 7.8,
      north: 8.1,
      west: 98.2,
      east: 98.5,
    })
    assert.ok(consumeCatalogMapViewport())
    assert.equal(peekCatalogMapViewport(), null)
  })

  it('capture without map/viewport clears stale viewport', () => {
    mockWindow({
      pathname: '/listings',
      hash: '',
      seed: {},
    })
    captureCatalogReturnBeforePdp()
    assert.equal(peekCatalogMapViewport(), null)
  })

  it('capture with viewport keeps memory and forces #map on return href', () => {
    mockWindow({
      pathname: '/listings',
      hash: '',
      seed: {
        'airento:catalog-map-viewport-v1': JSON.stringify({
          south: 7.8,
          north: 8.1,
          west: 98.2,
          east: 98.5,
          centerLat: 7.9,
          centerLng: 98.3,
          zoom: 12,
        }),
      },
    })
    captureCatalogReturnBeforePdp()
    assert.ok(peekCatalogMapViewport())
    assert.match(String(peekCatalogReturnHref() || ''), /#map/)
    clearCatalogMapViewport()
  })

  it('capture from #map keeps viewport', () => {
    mockWindow({
      pathname: '/listings',
      hash: '#map',
      seed: {
        'airento:catalog-map-viewport-v1': JSON.stringify({
          south: 7.8,
          north: 8.1,
          west: 98.2,
          east: 98.5,
        }),
      },
    })
    captureCatalogReturnBeforePdp()
    assert.ok(peekCatalogMapViewport())
    clearCatalogMapViewport()
  })
})
