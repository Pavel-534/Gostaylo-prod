/**
 * Stage 201.110 — Home Top → PDP Back must not cover Home with catalog skeleton.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-110-home-top-pdp-back.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { shouldPaintPendingCatalogSkeleton } from '../lib/navigation/pending-catalog-skeleton.js'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.110 — Home Top PDP back does not hang Home', () => {
  it('catalog skeleton only while live route is Home and pending is catalog', () => {
    assert.equal(shouldPaintPendingCatalogSkeleton('/', '/listings'), true)
    assert.equal(shouldPaintPendingCatalogSkeleton('/', '/listings?q=1'), true)
    assert.equal(shouldPaintPendingCatalogSkeleton('/listings/car-1', '/listings'), false)
    assert.equal(shouldPaintPendingCatalogSkeleton('/', '/listings/car-1'), false)
    assert.equal(shouldPaintPendingCatalogSkeleton('/', '/'), false)
  })

  it('shell arms from live window path; PDP soft-back pending home when popping', () => {
    const shell = read('components/navigation/StorefrontPendingCatalogShell.jsx')
    assert.match(shell, /shouldPaintPendingCatalogSkeleton\(livePathname\(\), href\)/)
    const hook = read('hooks/use-soft-back.js')
    assert.match(hook, /dispatchOptimisticNavPending\(isListingPdpPath\(pathname\) \? '\/' : fallback\)/)
    assert.match(hook, /if \(catalogReturn && isCatalogListingsHref\(catalogReturn\)\)/)
  })
})
