/**
 * Stage 201.21 — catalog scroll SSOT (live query key + persist on PDP navigate).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-21-catalog-scroll-ssot.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.21 — catalog scroll SSOT', () => {
  /** @type {Record<string, string>} */
  let store

  beforeEach(() => {
    store = {}
    globalThis.window = {
      location: { pathname: '/listings', search: '?semantic=1' },
      scrollY: 1400,
      sessionStorage: {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k, v) => {
          store[k] = String(v)
        },
        removeItem: (k) => {
          delete store[k]
        },
      },
    }
    globalThis.document = { querySelectorAll: () => [] }
  })

  afterEach(() => {
    delete globalThis.window
    delete globalThis.document
  })

  it('liveRouteScrollKey uses window search (semantic catalog)', () => {
    const {
      liveRouteScrollKey,
      routeScrollKeyFromLocation,
    } = require('../lib/navigation/route-scroll-memory.js')
    assert.equal(liveRouteScrollKey(), 'listings:semantic=1')
    assert.equal(routeScrollKeyFromLocation('/listings', '?semantic=1'), 'listings:semantic=1')
  })

  it('persistLiveRouteScroll writes catalog key before PDP', () => {
    const {
      persistLiveRouteScroll,
      peekRouteScrollEntry,
    } = require('../lib/navigation/route-scroll-memory.js')
    persistLiveRouteScroll({ anchorHref: '/listings/lst-villa-1', anchorTop: 220 })
    const entry = peekRouteScrollEntry('listings:semantic=1')
    assert.equal(entry.y, 1400)
    assert.equal(entry.anchorHref, '/listings/lst-villa-1')
    assert.equal(entry.anchorTop, 220)
  })

  it('peek pending restore does not consume the flag', () => {
    const {
      markPendingRouteScrollRestore,
      peekPendingRouteScrollRestore,
      consumePendingRouteScrollRestore,
    } = require('../lib/navigation/route-scroll-memory.js')
    markPendingRouteScrollRestore()
    assert.equal(peekPendingRouteScrollRestore(), true)
    assert.equal(peekPendingRouteScrollRestore(), true)
    assert.equal(consumePendingRouteScrollRestore(), true)
    assert.equal(peekPendingRouteScrollRestore(), false)
  })

  it('hero transition and host wire persistLiveRouteScroll + live key', () => {
    const hero = read('lib/navigation/listing-hero-transition.js')
    assert.match(hero, /persistLiveRouteScroll/)
    const host = read('components/navigation/RouteScrollMemoryHost.jsx')
    assert.match(host, /liveRouteScrollKey/)
    assert.match(host, /peekPendingRouteScrollRestore/)
    const catalog = read('app/(storefront)/listings/listings-catalog-client.jsx')
    assert.match(catalog, /navigateWithListingHeroTransition\([\s\S]*listingId,/)
  })
})
