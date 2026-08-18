/**
 * Stage 201.97 — catalog JS prewarm, Search tab keep-alive, mobile above-fold cards.
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

describe('Stage 201.97 / 201.102 — catalog keep-alive + prewarm + above-fold', () => {
  it('keeps only home + catalog list alive (not PDP/messages)', () => {
    assert.equal(isStorefrontCatalogListPath('/listings'), true)
    assert.equal(isStorefrontCatalogListPath('/listings/'), true)
    assert.equal(isStorefrontCatalogListPath('/listings/abc'), false)
    assert.equal(isStorefrontSearchKeepAlivePath('/'), true)
    assert.equal(isStorefrontSearchKeepAlivePath('/listings'), true)
    assert.equal(isStorefrontSearchKeepAlivePath('/listings/abc'), false)
    assert.equal(isStorefrontSearchKeepAlivePath('/messages'), false)
  })

  it('prewarms catalog client chunks, not Leaflet or FilterBar', () => {
    assert.ok(CATALOG_CHUNK_PREWARM_MODULES.some((m) => m.includes('listings-catalog-client')))
    const src = read('lib/navigation/prewarm-catalog-chunks.js')
    assert.doesNotMatch(src, /import\(['"]@\/components\/search\/FilterBar['"]\)/)
    assert.doesNotMatch(src, /import\(['"]@\/components\/search\/SearchMapWrapper['"]\)/)
    assert.match(read('components/PlatformHomeContent.jsx'), /scheduleCatalogChunkPrewarm/)
  })

  it('parks catalog UI in the storefront shell, not in CatalogHydrationBoundary', () => {
    const boundary = read('components/catalog/CatalogHydrationBoundary.jsx')
    assert.doesNotMatch(boundary, /ListingsCatalogClient/)
    assert.match(
      read('components/layout/StorefrontAppShell.jsx'),
      /StorefrontSearchKeepAlivePane/,
    )
    assert.match(
      read('components/navigation/StorefrontSearchKeepAlive.jsx'),
      /listings-catalog-client/,
    )
    assert.match(read('lib/hooks/use-public-search-filters.js'), /revealStorefrontSearchKeepAlive/)
    assert.match(read('lib/hooks/use-public-search-filters.js'), /urlSyncEnabled/)
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
