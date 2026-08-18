/**
 * Stage 201.99 — Home widget cache 10 min; catalog search stays lite (card fields, not full PDP).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-99-home-widget-cache-catalog-lite.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { HOME_WIDGET_STALE_MS, HOME_WIDGET_QUERY_OPTIONS } from '@/lib/query-prefetch/home-query-constants.js'
import { LISTINGS_SELECT_LITE } from '@/lib/api/search/listing-search-payload.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.99 — Home widget cache + catalog lite lock', () => {
  it('home rails use 10 min stale and skip mount/focus refetch', () => {
    assert.equal(HOME_WIDGET_STALE_MS, 10 * 60 * 1000)
    assert.equal(HOME_WIDGET_QUERY_OPTIONS.refetchOnMount, false)
    assert.equal(HOME_WIDGET_QUERY_OPTIONS.refetchOnWindowFocus, false)
    const forYou = read('components/recommendations/ForYouRail.jsx')
    assert.match(forYou, /HOME_WIDGET_QUERY_OPTIONS/)
    const featured = read('hooks/home/use-platform-home-page.js')
    assert.match(featured, /HOME_WIDGET_QUERY_OPTIONS/)
    const recent = read('lib/hooks/use-recently-viewed.js')
    assert.match(recent, /HOME_WIDGET_QUERY_OPTIONS/)
    assert.match(recent, /useQuery/)
  })

  it('catalog Search tab still does not open the filter sheet', () => {
    const client = read('app/(storefront)/listings/listings-catalog-client.jsx')
    const subscribe = client.match(
      /subscribeMobileSearchTabAction\(\(\) => \{[\s\S]*?\n    \}\)/,
    )
    assert.ok(subscribe)
    assert.doesNotMatch(subscribe[0], /setMobileSearchOpen\(true\)/)
    assert.match(client, /onOpenSearch=\{\(\) => setMobileSearchOpen\(true\)\}/)
  })

  it('search SELECT omits description and maps lite images, not a full PDP row', () => {
    assert.doesNotMatch(LISTINGS_SELECT_LITE, /(?:^|,)\s*description\s*(?:,|$)/m)
    assert.match(LISTINGS_SELECT_LITE, /\btitle\b/)
    assert.match(LISTINGS_SELECT_LITE, /\bbase_price_thb\b/)
    assert.match(LISTINGS_SELECT_LITE, /\bimages\b/)
    const search = read('lib/api/run-listings-search-get.js')
    assert.match(search, /const isLite = options\.isLite !== false/)
    assert.match(search, /imagesMapped\.slice\(0, 3\)/)
    assert.match(search, /isLite \? \{\} : \{ description: l\.description \}/)
    const v2search = read('app/api/v2/search/route.js')
    assert.match(v2search, /isLite: true/)
  })
})
