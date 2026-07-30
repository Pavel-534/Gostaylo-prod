import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchesOptimisticNavHref,
  matchesOptimisticNavTab,
  isOptimisticDockTabActive,
} from '../lib/navigation/optimistic-nav-href.js'

describe('optimistic-nav-href Stage 200.13/200.14/200.18', () => {
  it('matches exact and nested hrefs', () => {
    assert.equal(matchesOptimisticNavHref('/listings', '/listings'), true)
    assert.equal(matchesOptimisticNavHref('/messages/abc', '/messages'), true)
    assert.equal(matchesOptimisticNavHref('/renter/profile', '/'), false)
    assert.equal(matchesOptimisticNavHref('/', '/'), true)
    assert.equal(matchesOptimisticNavHref('/listings', '/'), false)
  })

  it('keeps query destinations distinct from bare listings (header)', () => {
    assert.equal(
      matchesOptimisticNavHref('/listings?group=destinations', '/listings?group=destinations'),
      true,
    )
    assert.equal(matchesOptimisticNavHref('/listings?group=destinations', '/listings'), false)
    assert.equal(matchesOptimisticNavHref('/listings', '/listings?group=destinations'), false)
  })

  it('dock tab match lights Search for /listings?filters', () => {
    assert.equal(matchesOptimisticNavTab('/listings?sort=price_asc', '/listings'), true)
    assert.equal(matchesOptimisticNavTab('/listings', '/listings'), true)
    assert.equal(matchesOptimisticNavTab('/', '/listings'), false)
  })

  it('exclusive dock active suppresses sibling while pending', () => {
    assert.equal(
      isOptimisticDockTabActive({
        routeActive: true,
        pendingHref: '/',
        itemHref: '/listings',
        activeMatches: ['/listings', '/search'],
      }),
      false,
    )
    assert.equal(
      isOptimisticDockTabActive({
        routeActive: false,
        pendingHref: '/',
        itemHref: '/',
      }),
      true,
    )
    assert.equal(
      isOptimisticDockTabActive({
        routeActive: true,
        pendingHref: null,
        itemHref: '/listings',
        activeMatches: ['/listings'],
      }),
      true,
    )
  })
})
