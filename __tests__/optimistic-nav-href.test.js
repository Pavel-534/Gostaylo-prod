import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { matchesOptimisticNavHref } from '../lib/navigation/optimistic-nav-href.js'

describe('optimistic-nav-href Stage 200.13/200.14', () => {
  it('matches exact and nested hrefs', () => {
    assert.equal(matchesOptimisticNavHref('/listings', '/listings'), true)
    assert.equal(matchesOptimisticNavHref('/messages/abc', '/messages'), true)
    assert.equal(matchesOptimisticNavHref('/renter/profile', '/'), false)
    assert.equal(matchesOptimisticNavHref('/', '/'), true)
    assert.equal(matchesOptimisticNavHref('/listings', '/'), false)
  })

  it('keeps query destinations distinct from bare listings', () => {
    assert.equal(
      matchesOptimisticNavHref('/listings?group=destinations', '/listings?group=destinations'),
      true,
    )
    assert.equal(matchesOptimisticNavHref('/listings?group=destinations', '/listings'), false)
    assert.equal(matchesOptimisticNavHref('/listings', '/listings?group=destinations'), false)
  })
})
