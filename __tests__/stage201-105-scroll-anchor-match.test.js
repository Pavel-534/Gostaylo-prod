/**
 * Stage 201.105 — choose nearest matching anchor for scroll restore.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-105-scroll-anchor-match.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.105 — scroll anchor matching', () => {
  beforeEach(() => {
    globalThis.document = { querySelectorAll: () => [] }
  })

  afterEach(() => {
    delete globalThis.document
  })

  it('picks nearest duplicate href by saved anchorTop', () => {
    const topLink = {
      getAttribute: () => '/legal/privacy/',
      getBoundingClientRect: () => ({ top: 32 }),
    }
    const footerLink = {
      getAttribute: () => '/legal/privacy/',
      getBoundingClientRect: () => ({ top: 612 }),
    }
    const other = {
      getAttribute: () => '/help/',
      getBoundingClientRect: () => ({ top: 600 }),
    }
    globalThis.document = {
      querySelectorAll: () => [topLink, other, footerLink],
    }
    const { findScrollAnchorElement } = require('../lib/navigation/route-scroll-memory.js')
    assert.equal(findScrollAnchorElement('/legal/privacy/', 600), footerLink)
    assert.equal(findScrollAnchorElement('/legal/privacy/', 40), topLink)
  })

  it('host restore checks anchor with anchorTop + layout readiness', () => {
    const host = read('components/navigation/RouteScrollMemoryHost.jsx')
    assert.match(host, /findScrollAnchorElement\(entry\.anchorHref, entry\.anchorTop\)/)
    assert.match(host, /isRouteScrollLayoutReady/)
    assert.match(host, /resolveRouteScrollRestoreStep/)
  })
})
