/**
 * Stage 201.97 / 201.103 — catalog keep-alive helpers remain for path checks.
 * UI no longer parks in the storefront shell (201.103).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-97-catalog-keep-alive.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  isStorefrontCatalogListPath,
  isStorefrontSearchKeepAlivePath,
} from '@/lib/navigation/storefront-search-keep-alive.js'
import { CATALOG_CHUNK_PREWARM_MODULES } from '@/lib/navigation/prewarm-catalog-chunks.js'
import { MOBILE_CATALOG_ABOVE_FOLD_COUNT } from '@/lib/listing/listing-card-layout.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.97 / 201.103 — catalog paths + above-fold', () => {
  it('treats only home + catalog list as keep-alive paths (not PDP/messages)', () => {
    assert.equal(isStorefrontCatalogListPath('/listings'), true)
    assert.equal(isStorefrontCatalogListPath('/listings/'), true)
    assert.equal(isStorefrontCatalogListPath('/listings/abc'), false)
    assert.equal(isStorefrontSearchKeepAlivePath('/'), true)
    assert.equal(isStorefrontSearchKeepAlivePath('/listings'), true)
    assert.equal(isStorefrontSearchKeepAlivePath('/listings/abc'), false)
    assert.equal(isStorefrontSearchKeepAlivePath('/messages'), false)
  })

  it('does not prewarm catalog chunks from Home', () => {
    assert.ok(CATALOG_CHUNK_PREWARM_MODULES.some((m) => m.includes('listings-catalog-client')))
    assert.doesNotMatch(read('components/PlatformHomeContent.jsx'), /scheduleCatalogChunkPrewarm/)
  })

  it('renders catalog UI inside CatalogHydrationBoundary, not the storefront shell', () => {
    const boundary = read('components/catalog/CatalogHydrationBoundary.jsx')
    const page = read('app/(storefront)/listings/page.js')
    const pane = read('components/navigation/StorefrontSearchKeepAlive.jsx')
    assert.match(page, /ListingsCatalogClient/)
    assert.match(page, /CatalogHydrationBoundary/)
    assert.doesNotMatch(pane, /listings-catalog-client/)
    assert.doesNotMatch(boundary, /ListingsCatalogClient/)
  })

  it('defers below-fold mobile cards and lazy-loads non-LCP images', () => {
    assert.equal(MOBILE_CATALOG_ABOVE_FOLD_COUNT, 6)
    const sidebar = read('components/search/ListingSidebar.jsx')
    assert.match(sidebar, /CatalogDeferredCardSlot/)
    assert.match(sidebar, /MOBILE_CATALOG_ABOVE_FOLD_COUNT/)
    const carousel = read('components/card/CardImageCarousel.jsx')
    assert.match(carousel, /loading=\{priority && currentIndex === 0 \? 'eager' : 'lazy'\}/)
  })
})
