/**
 * Stage 201.16 — home scroll key SSOT (restore moved to root host in 201.18).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-16-home-scroll-memory.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('Stage 201.16 — home scroll memory key', () => {
  it('homeScrollKey is accepted by route-scroll-memory SSOT', () => {
    const {
      homeScrollKey,
      isScrollMemoryRouteKey,
      routeScrollKeyFromLocation,
    } = require('../lib/navigation/route-scroll-memory.js')
    assert.equal(homeScrollKey(), 'home')
    assert.equal(isScrollMemoryRouteKey(homeScrollKey()), true)
    assert.equal(routeScrollKeyFromLocation('/'), 'home')
  })
})
