/**
 * Map pin vs catalog card — guest display price SSOT (Stage 177.1.1 fix).
 * Run: npm run test:map-pin-price
 */

const { describe, it, before } = require('node:test')
const assert = require('node:assert/strict')

describe('map pin guest display price SSOT', () => {
  let getMapPinGuestDisplayThb
  let getGuestDisplayPerNight

  before(async () => {
    ;({ getMapPinGuestDisplayThb, getGuestDisplayPerNight } = await import(
      '../lib/pricing/guest-display-price.js'
    ))
  })

  it('getMapPinGuestDisplayThb uses platform guest fee % and _pricing average', () => {
    const row = {
      id: 'lst-test-1',
      base_price_thb: 10000,
      _pricing: { averagePerNight: 12000 },
    }
    const pinThb = getMapPinGuestDisplayThb(row, 10)
    const catalogThb = getGuestDisplayPerNight({
      base_price_thb: row.base_price_thb,
      basePriceThb: row.base_price_thb,
      pricing: row._pricing,
      guestServiceFeePercent: 10,
    })
    assert.equal(pinThb, catalogThb)
    assert.equal(pinThb, 13200)
  })

  it('getMapPinGuestDisplayThb matches guestDisplayPriceThb from search listing', () => {
    const row = {
      id: 'lst-test-2',
      base_price_thb: 5000,
    }
    const guestDisplayPriceThb = getGuestDisplayPerNight({
      base_price_thb: row.base_price_thb,
      guestServiceFeePercent: 8,
    })
    const pinThb = getMapPinGuestDisplayThb(row, 8)
    const fromSearchListing = {
      id: row.id,
      basePriceThb: row.base_price_thb,
      guestDisplayPriceThb,
      guestServiceFeePercent: 8,
    }
    assert.equal(pinThb, getGuestDisplayPerNight(fromSearchListing))
  })
})
