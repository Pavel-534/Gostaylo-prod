/**
 * Stage 201.74 — catalog return href + soft-back restore for PDP.
 */
import assert from 'node:assert/strict'
import { describe, it, beforeEach } from 'node:test'
import {
  isCatalogListingsHref,
  normalizeCatalogReturnHref,
  rememberCatalogReturnHref,
  peekCatalogReturnHref,
  resolveListingPdpSoftBackHref,
  captureCatalogReturnBeforePdp,
} from '../lib/navigation/catalog-return-href.js'

function mockWindow({ pathname, search = '', seed = null }) {
  const m = new Map()
  if (seed && typeof seed === 'object') {
    for (const [k, v] of Object.entries(seed)) m.set(k, String(v))
  }
  globalThis.window = {
    location: { pathname, search, hash: '' },
    sessionStorage: {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
    },
  }
}

describe('Stage 201.74 catalog return href', () => {
  beforeEach(() => {
    mockWindow({ pathname: '/listings', search: '?semantic=1' })
  })

  it('accepts catalog list URLs only (not PDP)', () => {
    assert.equal(isCatalogListingsHref('/listings'), true)
    assert.equal(isCatalogListingsHref('/listings?semantic=1'), true)
    assert.equal(isCatalogListingsHref('/listings/lst-1'), false)
    assert.equal(normalizeCatalogReturnHref('/listings?semantic=1'), '/listings?semantic=1')
    assert.equal(normalizeCatalogReturnHref('/listings/lst-1'), null)
  })

  it('remembers live catalog URL for PDP soft-back', () => {
    rememberCatalogReturnHref()
    assert.equal(peekCatalogReturnHref(), '/listings?semantic=1')
    assert.equal(resolveListingPdpSoftBackHref('/listings'), '/listings?semantic=1')
  })

  it('capture before PDP clears stale return when leaving non-catalog', () => {
    mockWindow({
      pathname: '/',
      search: '',
      seed: { 'airento:catalog-return-href-v1': '/listings?semantic=1' },
    })
    assert.equal(peekCatalogReturnHref(), '/listings?semantic=1')
    captureCatalogReturnBeforePdp()
    assert.equal(peekCatalogReturnHref(), null)
  })
})
