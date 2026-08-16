/**
 * Stage 201.78 — catalog mobile map hash SSOT.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CATALOG_MOBILE_MAP_HASH,
  isCatalogMobileMapHash,
} from '../lib/navigation/catalog-mobile-map-hash.js'

describe('Stage 201.78 catalog mobile map hash', () => {
  it('recognizes #map only', () => {
    assert.equal(CATALOG_MOBILE_MAP_HASH, 'map')
    assert.equal(isCatalogMobileMapHash('#map'), true)
    assert.equal(isCatalogMobileMapHash('map'), true)
    assert.equal(isCatalogMobileMapHash('#MAP'), true)
    assert.equal(isCatalogMobileMapHash(''), false)
    assert.equal(isCatalogMobileMapHash('#foo'), false)
  })
})
