/**
 * Stage 201.22 — catalog Back restore retries live key; pending survives sessionStorage.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-22-catalog-scroll-restore-retry.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.22 — catalog scroll restore retry', () => {
  /** @type {Record<string, string>} */
  let store

  beforeEach(() => {
    store = {}
    globalThis.window = {
      location: { pathname: '/listings', search: '?semantic=1' },
      scrollY: 0,
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

  it('pending restore flag is stored in sessionStorage', () => {
    const {
      markPendingRouteScrollRestore,
      peekPendingRouteScrollRestore,
      consumePendingRouteScrollRestore,
    } = require('../lib/navigation/route-scroll-memory.js')
    markPendingRouteScrollRestore()
    assert.equal(store['airento:route-scroll-pending-v1'], '1')
    assert.equal(peekPendingRouteScrollRestore(), true)
    assert.equal(consumePendingRouteScrollRestore(), true)
    assert.equal(store['airento:route-scroll-pending-v1'], undefined)
    assert.equal(peekPendingRouteScrollRestore(), false)
  })

  it('host retries liveRouteScrollKey while pending (does not bail on first miss)', () => {
    const host = read('components/navigation/RouteScrollMemoryHost.jsx')
    assert.match(host, /liveRouteScrollKey\(\)/)
    assert.match(host, /setRestoreGen/)
    assert.match(host, /markPendingRouteScrollRestore/)
    assert.doesNotMatch(host, /routeScrollKeyFromLocation\(pathname, searchKey\)/)
    assert.match(host, /if \(!activeEntry\)/)
  })
})
