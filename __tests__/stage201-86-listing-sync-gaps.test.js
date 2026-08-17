/**
 * Stage 201.86 — listing sync P0/P1: Instant Book mapper, Concierge amenities/geo, fees PDP.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-86-listing-sync-gaps.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mapListingDetailFromApi } from '@/lib/catalog/map-listing-detail-api.js'
import {
  conciergeAmenitiesToSlugList,
  validateConciergeListingItem,
} from '@/lib/services/concierge/concierge-supply.service.js'
import { METADATA_KEYS_ALWAYS_ALLOWED } from '@/lib/config/category-form-schema.js'
import { buildGuestPriceExclusionHints } from '@/lib/booking/guest-price-exclusions.js'

const root = process.cwd()

describe('Stage 201.86 listing sync gaps', () => {
  it('mapListingDetailFromApi passes instantBooking', () => {
    const mapped = mapListingDetailFromApi({
      id: 'l1',
      title: 'T',
      basePriceThb: 100,
      guestDisplayPriceThb: 110,
      commissionRate: 0.1,
      instantBooking: true,
      metadata: {},
    })
    assert.equal(mapped.instantBooking, true)

    const off = mapListingDetailFromApi({
      id: 'l2',
      title: 'T',
      basePriceThb: 100,
      guestDisplayPriceThb: 110,
      commissionRate: 0.1,
      instant_booking: false,
      metadata: {},
    })
    assert.equal(off.instantBooking, false)
  })

  it('validateConciergeListingItem keeps amenities + geo codes', () => {
    const v = validateConciergeListingItem({
      externalId: 'U1',
      title: 'Villa',
      basePriceThb: 2500,
      amenities: { wifi: true, pool: true, gym: false },
      geo: { lat: 7.8, lng: 98.3, countryCode: 'th', cityCode: 'Phuket', addressText: 'Karon' },
      images: ['https://cdn.example/a.jpg'],
    })
    assert.equal(v.ok, true)
    assert.ok(v.value.amenities.includes('wifi'))
    assert.ok(v.value.amenities.includes('pool'))
    assert.ok(!v.value.amenities.includes('gym'))
    assert.equal(v.value.geo.countryCode, 'TH')
    assert.equal(v.value.geo.cityCode, 'phuket')
  })

  it('conciergeAmenitiesToSlugList accepts arrays', () => {
    assert.deepEqual(conciergeAmenitiesToSlugList(['Wifi', 'pool']), ['wifi', 'pool'])
  })

  it('house_rules is whitelisted for wizard metadata', () => {
    assert.ok(METADATA_KEYS_ALWAYS_ALLOWED.has('house_rules'))
    const wizard = readFileSync(
      join(root, 'app/(partner)/partner/listings/new/components/StepGeneralInfo.jsx'),
      'utf8',
    )
    assert.ok(wizard.includes("updateMetadata('house_rules'"))
    assert.ok(wizard.includes('wizard-house-rules'))
  })

  it('PDP wires guest fee hints component', () => {
    const desc = readFileSync(
      join(root, 'components/listing/pdp/ListingDescription.jsx'),
      'utf8',
    )
    assert.ok(desc.includes('ListingGuestFeeHints'))
    const hints = buildGuestPriceExclusionHints('apartments', {
      cleaning_fee_thb: 300,
      security_deposit_thb: 1000,
    })
    assert.equal(hints.length, 2)
  })
})
