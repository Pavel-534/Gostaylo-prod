/**
 * Stage 202.28 — country change must not keep stale region/city codes (TH → RU).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-28-listing-country-change-geo.test.js
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveListingGeoWriteCascadeInput } from '@/lib/partner/resolve-listing-geo-write-cascade.js'
import { applyListingGeoSnapshotToUpdateData } from '@/lib/partner/apply-listing-geo-snapshot.js'

test('resolveListingGeoWriteCascadeInput drops stale region/city when country changes', () => {
  const out = resolveListingGeoWriteCascadeInput(
    { country: 'RU', city: 'ulan-ude' },
    { country_code: 'TH', region_code: 'TH-PHK', city_code: 'phuket-city' },
  )
  assert.equal(out.countryCode, 'RU')
  assert.equal(out.regionCode, null)
  assert.equal(out.cityCode, 'ulan-ude')
  assert.equal(out.countryChanged, true)
})

test('applyListingGeoSnapshotToUpdateData clears TH region on country change to RU + ulan-ude', () => {
  const { updateData } = applyListingGeoSnapshotToUpdateData(
    {},
    { country: 'RU', city: 'ulan-ude', district: 'Железнодорожный район' },
    {
      country_code: 'TH',
      region_code: 'TH-PHK',
      city_code: 'phuket-city',
      district: 'Patong',
      metadata: { city: 'Phuket' },
    },
  )
  assert.equal(updateData.country_code, 'RU')
  assert.equal(updateData.region_code, 'RU-BU')
  assert.equal(updateData.city_code, 'ulan-ude')
  assert.equal(updateData.district, 'Железнодорожный район')
})

test('unchanged country keeps existing region/city when body omits them', () => {
  const out = resolveListingGeoWriteCascadeInput(
    { district: 'Patong' },
    { country_code: 'TH', region_code: 'TH-PHK', city_code: 'phuket-city' },
  )
  assert.equal(out.countryCode, 'TH')
  assert.equal(out.regionCode, 'TH-PHK')
  assert.equal(out.cityCode, 'phuket-city')
  assert.equal(out.countryChanged, false)
})
