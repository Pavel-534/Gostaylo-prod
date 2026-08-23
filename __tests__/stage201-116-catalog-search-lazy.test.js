/**
 * Stage 201.116 — catalog search chrome aligned with UnifiedSearchBarLazy SSOT.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-116-catalog-search-lazy.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.116 — catalog UnifiedSearchBarLazy alignment', () => {
  it('catalog does not ad-hoc dynamic() UnifiedSearchBar; uses CompactLazy SSOT', () => {
    const src = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.doesNotMatch(src, /from ['"]@\/components\/search\/UnifiedSearchBar['"]/)
    assert.doesNotMatch(
      src,
      /dynamic\(\s*\(\) => import\(['"]@\/components\/search\/UnifiedSearchBar['"]\)/,
    )
    assert.match(src, /UnifiedSearchBarCompactLazy/)
    assert.match(src, /prefetchUnifiedSearchBarChunk/)
    assert.match(src, /HomeSearchBarSkeleton/)
  })

  it('FilterBar lazy mount uses ssr + filter skeleton (not null loading)', () => {
    const src = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.match(src, /import\(['"]@\/components\/search\/FilterBar['"]\)/)
    assert.match(src, /ssr:\s*true/)
    assert.match(src, /HomeSearchBarSkeleton variant="filter"/)
  })

  it('SSOT lazy module exposes hero/compact/filter with ssr true', () => {
    const lazy = read('components/search/UnifiedSearchBarLazy.jsx')
    assert.match(lazy, /UnifiedSearchBarHeroLazy/)
    assert.match(lazy, /UnifiedSearchBarCompactLazy/)
    assert.match(lazy, /UnifiedSearchBarFilterLazy/)
    assert.match(lazy, /ssr: true/)
    assert.match(lazy, /variant="filter"/)
  })

  it('HomeSearchBarSkeleton includes filter variant', () => {
    const sk = read('components/home/HomeSearchBarSkeleton.jsx')
    assert.match(sk, /variant === 'filter'/)
    assert.match(sk, /home-search-bar-skeleton-filter/)
  })
})
