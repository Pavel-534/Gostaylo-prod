/**
 * Stage 201.20 — anchor-aligned scroll restore.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-20-scroll-anchor.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.20 — scroll anchor memory', () => {
  /** @type {Record<string, string>} */
  let store

  beforeEach(() => {
    store = {}
    globalThis.window = {
      sessionStorage: {
        getItem: (k) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null),
        setItem: (k, v) => {
          store[k] = String(v)
        },
      },
    }
  })

  afterEach(() => {
    delete globalThis.window
  })

  it('saveRouteScroll keeps anchor when later plain Y updates', () => {
    const {
      saveRouteScroll,
      peekRouteScrollEntry,
    } = require('../lib/navigation/route-scroll-memory.js')
    saveRouteScroll('home', {
      y: 1200,
      anchorHref: '/listings/lst-villa-1',
      anchorTop: 180,
    })
    saveRouteScroll('home', 1250)
    const entry = peekRouteScrollEntry('home')
    assert.equal(entry.y, 1250)
    assert.equal(entry.anchorHref, '/listings/lst-villa-1')
    assert.equal(entry.anchorTop, 180)
  })

  it('normalizeScrollAnchorPath strips origin and trailing slash', () => {
    const { normalizeScrollAnchorPath } = require('../lib/navigation/route-scroll-memory.js')
    assert.equal(normalizeScrollAnchorPath('/listings/abc/'), '/listings/abc')
    assert.equal(normalizeScrollAnchorPath('https://airento.ru/listings/abc?x=1'), '/listings/abc?x=1')
  })

  it('host saves and restores via anchorHref', () => {
    const host = read('components/navigation/RouteScrollMemoryHost.jsx')
    assert.match(host, /anchorHref/)
    assert.match(host, /applyRouteScrollEntry/)
    assert.match(host, /anchorTop/)
  })
})
