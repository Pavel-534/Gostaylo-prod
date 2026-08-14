/**
 * Stage 201.18 — root RouteScrollMemoryHost (pop/soft-back restore).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-18-route-scroll-host.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.18 — root scroll memory host', () => {
  it('routeScrollKeyFromLocation maps home and listings', () => {
    const {
      routeScrollKeyFromLocation,
      homeScrollKey,
    } = require('../lib/navigation/route-scroll-memory.js')
    assert.equal(routeScrollKeyFromLocation('/'), homeScrollKey())
    assert.equal(routeScrollKeyFromLocation('/listings', 'q=villa'), 'listings:q=villa')
    assert.equal(routeScrollKeyFromLocation('/legal/privacy'), null)
  })

  it('root providers mount RouteScrollMemoryHost; soft-back marks pending restore', () => {
    assert.match(read('components/providers/RootClientProviders.jsx'), /RouteScrollMemoryHost/)
    assert.match(read('hooks/use-soft-back.js'), /markPendingRouteScrollRestore/)
    assert.match(read('components/navigation/RouteScrollMemoryHost.jsx'), /consumePendingRouteScrollRestore/)
    assert.match(read('components/navigation/RouteScrollMemoryHost.jsx'), /popstate/)
  })

  it('pending restore flag is one-shot', () => {
    const {
      markPendingRouteScrollRestore,
      consumePendingRouteScrollRestore,
    } = require('../lib/navigation/route-scroll-memory.js')
    markPendingRouteScrollRestore()
    assert.equal(consumePendingRouteScrollRestore(), true)
    assert.equal(consumePendingRouteScrollRestore(), false)
  })

  it('page-local useRouteScrollMemory no longer on home/catalog', () => {
    assert.doesNotMatch(read('components/PlatformHomeContent.jsx'), /useRouteScrollMemory/)
    assert.doesNotMatch(
      read('app/(storefront)/listings/listings-catalog-client.jsx'),
      /useRouteScrollMemory/,
    )
  })
})
