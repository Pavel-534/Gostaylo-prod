/**
 * Stage 201.101 — instant PDP shell from cache + history.back to parked catalog.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-101-instant-pdp-shell.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { QueryClient } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { queryKeys } from '@/lib/query-keys.js'
import { readPdpInstantListing } from '@/lib/listing/read-pdp-instant-listing.js'
import { storefrontListingPdpId } from '@/lib/navigation/storefront-search-keep-alive.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.101 — instant PDP shell + back', () => {
  it('reads listing chrome from detail or catalog search cache', () => {
    const qc = new QueryClient()
    assert.equal(readPdpInstantListing(qc, 'lst-1'), null)
    qc.setQueryData(queryKeys.listing.detail('lst-1'), { id: 'lst-1', title: 'NMAX' })
    assert.equal(readPdpInstantListing(qc, 'lst-1').title, 'NMAX')

    const qc2 = new QueryClient()
    qc2.setQueryData(queryKeys.catalog.search({ where: 'all' }), {
      listings: [{ id: 'lst-2', title: 'From catalog' }],
    })
    assert.equal(readPdpInstantListing(qc2, 'lst-2').title, 'From catalog')
  })

  it('streams PDP bootstrap behind Suspense; keeps 404/moderation await in the child', () => {
    const page = read('app/(storefront)/listings/[id]/page.js')
    assert.match(page, /Suspense fallback=\{<ListingPdpInstantShell/)
    assert.match(page, /async function ListingPdpRscBody/)
    assert.match(page, /getCachedListingPdpBootstrap/)
    assert.match(page, /notFound\(\)/)
    assert.equal(storefrontListingPdpId('/listings/yamaha-1'), 'yamaha-1')
  })

  it('ListingCard already prefetches the PDP route on touch/hover', () => {
    const card = read('components/listing-card.jsx')
    assert.match(card, /onTouchStart=\{handlePrefetch\}/)
    assert.match(card, /onMouseEnter=\{handlePrefetch\}/)
    assert.match(card, /prefetchListingPdp\(router, id\)/)
  })

  it('PDP header back pops history when catalog return exists', () => {
    const hook = read('hooks/use-soft-back.js')
    assert.match(hook, /router\.back\(\)/)
    assert.match(hook, /history\.length > 1/)
    const page = read('app/(storefront)/listings/[id]/page.js')
    assert.match(page, /ListingPdpInstantShell/)
    const pane = read('components/navigation/StorefrontSearchKeepAlive.jsx')
    assert.doesNotMatch(pane, /ListingPdpInstantShell/)
    assert.doesNotMatch(pane, /hidden=\{!catalogForeground\}/)
  })
})
