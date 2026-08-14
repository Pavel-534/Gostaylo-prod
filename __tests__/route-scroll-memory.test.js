import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isScrollMemoryRouteKey,
  listingsCatalogScrollKey,
  homeScrollKey,
} from '../lib/navigation/route-scroll-memory.js'

describe('route-scroll-memory Stage 200.17 / 201.16', () => {
  it('accepts catalog, home, and bookings keys', () => {
    assert.equal(isScrollMemoryRouteKey('listings:'), true)
    assert.equal(isScrollMemoryRouteKey('listings:group=destinations'), true)
    assert.equal(isScrollMemoryRouteKey('my-bookings:'), true)
    assert.equal(isScrollMemoryRouteKey('home'), true)
    assert.equal(isScrollMemoryRouteKey('/'), true)
    assert.equal(isScrollMemoryRouteKey('/admin'), false)
    assert.equal(isScrollMemoryRouteKey(''), false)
  })

  it('builds stable catalog and home scroll keys', () => {
    assert.equal(listingsCatalogScrollKey(''), 'listings:')
    assert.equal(listingsCatalogScrollKey('sort=price_asc'), 'listings:sort=price_asc')
    assert.equal(homeScrollKey(), 'home')
  })
})
