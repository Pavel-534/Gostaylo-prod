import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { listingPdpPrefetchPath } from '../lib/navigation/listing-hero-transition.js'

describe('listing-hero-transition Stage 200.15', () => {
  it('builds encoded PDP prefetch path without query', () => {
    assert.equal(listingPdpPrefetchPath('lst-abc'), '/listings/lst-abc')
    assert.equal(listingPdpPrefetchPath('a/b'), '/listings/a%2Fb')
    assert.equal(listingPdpPrefetchPath(''), null)
    assert.equal(listingPdpPrefetchPath(null), null)
  })
})
