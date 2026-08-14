/**
 * @vitest-environment jsdom
 * Stage 201.17 — scroll memory must survive Next pre-nav scroll reset.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-17-scroll-memory-persist.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.17 — scroll memory persist race', () => {
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

  it('saveRouteScroll does not clobber a positive Y with 0', () => {
    const {
      saveRouteScroll,
      peekRouteScroll,
    } = require('../lib/navigation/route-scroll-memory.js')
    saveRouteScroll('home', 1200)
    assert.equal(peekRouteScroll('home'), 1200)
    saveRouteScroll('home', 0)
    assert.equal(peekRouteScroll('home'), 1200)
    saveRouteScroll('home', 800)
    assert.equal(peekRouteScroll('home'), 800)
  })

  it('hook persists on click capture and retries restore via peek', () => {
    const hook = read('hooks/use-route-scroll-memory.js')
    assert.match(hook, /onClickCapture/)
    assert.match(hook, /lastYRef/)
    assert.match(hook, /peekRouteScroll/)
    assert.match(hook, /RESTORE_BUDGET_MS/)
    assert.match(hook, /addEventListener\('click', onClickCapture, true\)/)
  })
})
