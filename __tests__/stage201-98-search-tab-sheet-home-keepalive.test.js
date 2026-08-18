/**
 * Stage 201.98 — Search tab does not open the sheet; Home rails stay parked.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-98-search-tab-sheet-home-keepalive.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.98 — Search tab sheet + Home keep-alive', () => {
  it('catalog Search tab does not open the filter sheet (FAB / summary bar still do)', () => {
    const client = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.match(client, /if \(!isStorefrontCatalogListPath\(window\.location\.pathname\)\) return/)
    const subscribe = client.match(
      /subscribeMobileSearchTabAction\(\(\) => \{[\s\S]*?\n    \}\)/,
    )
    assert.ok(subscribe)
    assert.doesNotMatch(subscribe[0], /setMobileSearchOpen\(true\)/)
    assert.match(client, /onOpenSearch=\{\(\) => setMobileSearchOpen\(true\)\}/)
    const action = read('lib/search/mobile-search-tab-action.js')
    assert.match(action, /do not open the search sheet/)
  })

  it('parks Home UI in the storefront shell like catalog', () => {
    const pane = read('components/navigation/StorefrontSearchKeepAlive.jsx')
    assert.match(pane, /PlatformHomeContent/)
    assert.match(pane, /storefront-home-keep-alive/)
    const homeBoundary = read('components/home/HomeHydrationBoundary.jsx')
    assert.doesNotMatch(homeBoundary, /PlatformHomeContent/)
  })

  it('For You uses TanStack Query; recently viewed hydrates via query cache', () => {
    const forYou = read('components/recommendations/ForYouRail.jsx')
    assert.match(forYou, /queryKeys\.recommendations\.forYou/)
    assert.match(forYou, /useQuery/)
    const recent = read('lib/hooks/use-recently-viewed.js')
    assert.match(recent, /hydrateRecentlyViewedListings/)
    assert.match(recent, /placeholderData/)
  })
})
