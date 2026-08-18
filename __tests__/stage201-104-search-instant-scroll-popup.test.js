/**
 * Stage 201.104 — instant Search shell, map popup close chip, scroll restore wait for layout.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-104-search-instant-scroll-popup.test.js
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function read(rel) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('Stage 201.104 — Search instant shell + popup close + scroll restore', () => {
  it('listings page streams catalog body; metadata skips heavy bootstrap', () => {
    const page = read('app/(storefront)/listings/page.js')
    assert.match(page, /async function ListingsCatalogRscBody/)
    assert.match(page, /skipHeavyBootstrap: true/)
    assert.match(page, /Suspense fallback=\{<ListingsCatalogSkeleton/)
    const meta = read('lib/seo/listings-catalog-metadata.js')
    assert.match(meta, /skipHeavyBootstrap/)
    const gen = page.match(/export async function generateMetadata\([\s\S]*?\n\}/)
    assert.ok(gen)
    assert.doesNotMatch(gen[0], /getCatalogBootstrapFromSearchParams/)
  })

  it('Home Search pending paints catalog skeleton before RSC', () => {
    const shell = read('components/layout/StorefrontAppShell.jsx')
    assert.match(shell, /StorefrontPendingCatalogShell/)
    const pending = read('components/navigation/StorefrontPendingCatalogShell.jsx')
    assert.match(pending, /AIRENTO_NAV_PENDING_EVENT/)
    assert.match(pending, /shouldPaintPendingCatalogSkeleton/)
    assert.match(pending, /ListingsCatalogSkeleton/)
  })

  it('map popup close control is a compact brand chip', () => {
    const css = read('components/listing/map-listing-popup.css')
    assert.match(css, /leaflet-popup-close-button/)
    assert.match(css, /width: 40px/)
    assert.match(css, /border-radius: 9999px/)
  })

  it('scroll restore waits for layout and retries on resize', () => {
    const host = read('components/navigation/RouteScrollMemoryHost.jsx')
    assert.match(host, /RESTORE_BUDGET_MS = 8000/)
    assert.match(host, /ResizeObserver/)
    assert.match(host, /isRouteScrollLayoutReady/)
  })
})
