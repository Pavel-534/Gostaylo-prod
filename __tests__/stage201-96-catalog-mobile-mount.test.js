/**
 * Stage 201.96 — catalog does not hydrate desktop Leaflet / FilterBar on phone.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-96-catalog-mobile-mount.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { VIEWPORT_LG_MIN_PX, VIEWPORT_MD_MIN_PX } from '@/hooks/use-min-width.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.96 — catalog mobile-first mount', () => {
  it('exposes Tailwind md/lg gates and treats unmeasured viewport as not-desktop', () => {
    assert.equal(VIEWPORT_MD_MIN_PX, 768)
    assert.equal(VIEWPORT_LG_MIN_PX, 1024)
    const hook = read('hooks/use-min-width.js')
    assert.match(hook, /useMinWidthConfirmed/)
    assert.match(hook, /=== true/)
  })

  it('SearchMapWrapper refuses Leaflet until lg is confirmed', () => {
    const src = read('components/search/SearchMapWrapper.jsx')
    assert.match(src, /useMinWidthConfirmed\(VIEWPORT_LG_MIN_PX\)/)
    assert.match(src, /if \(!isDesktopMap\) return null/)
  })

  it('catalog client lazy-loads map and desktop search chrome; does not statically import them', () => {
    const src = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.doesNotMatch(src, /from ['"]@\/components\/search\/SearchMapWrapper['"]/)
    assert.doesNotMatch(src, /from ['"]@\/components\/search\/FilterBar['"]/)
    assert.doesNotMatch(src, /from ['"]@\/components\/search\/UnifiedSearchBar['"]/)
    assert.match(src, /dynamic\(\s*\(\) => import\(['"]@\/components\/search\/SearchMapWrapper['"]\)/)
    assert.match(src, /isLgUp \? \(/)
    assert.match(src, /isMdUp \? <FilterBar/)
    assert.match(src, /searchSheetReady \? \(/)
    assert.match(src, /\{showMap \? \(/)
  })

  it('home Search tab prefetches the catalog href with current filters, not only bare /listings', () => {
    const src = read('lib/hooks/use-public-search-filters.js')
    assert.match(src, /startTransition\(\(\) => \{/)
    assert.match(src, /router\.prefetch\(href\)/)
    assert.match(src, /buildCatalogHref\(debouncedFilterSnapshot\)/)
  })
})
