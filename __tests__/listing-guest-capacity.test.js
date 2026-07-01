/**
 * SSOT guest capacity — lib/listing-guest-capacity.js
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/listing-guest-capacity.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('listing guest capacity SSOT', () => {
  it('deriveListingMaxCapacityColumn — 5 bedrooms overrides stale max_capacity=1', async () => {
    const { deriveListingMaxCapacityColumn } = await import('../lib/listing-guest-capacity.js')
    const cap = deriveListingMaxCapacityColumn({
      categorySlug: 'property',
      metadata: { bedrooms: 5, bathrooms: 4 },
      maxCapacity: 1,
    })
    assert.equal(cap, 10)
  })

  it('deriveListingMaxCapacityColumn — transport uses seats', async () => {
    const { deriveListingMaxCapacityColumn } = await import('../lib/listing-guest-capacity.js')
    assert.equal(
      deriveListingMaxCapacityColumn({
        categorySlug: 'vehicles',
        metadata: { seats: 2, engine_cc: 160 },
        maxCapacity: 1,
      }),
      2,
    )
  })

  it('applyListingMaxCapacitySyncToRow — patches max_capacity and metadata.max_guests', async () => {
    const { applyListingMaxCapacitySyncToRow } = await import('../lib/listing-guest-capacity.js')
    const updateData = {
      metadata: { bedrooms: 3 },
    }
    applyListingMaxCapacitySyncToRow(updateData, {
      categorySlug: 'property',
      existing: { max_capacity: 1, metadata: {} },
    })
    assert.equal(updateData.max_capacity, 6)
    assert.equal(updateData.metadata.max_guests, 6)
  })
})
