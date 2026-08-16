/**
 * Stage 201.79 — mobile map rail follows viewport pins / bbox.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  filterCatalogRailListingsForMapViewport,
  pointInCatalogMapBbox,
} from '../lib/maps/catalog-map-rail-filter.js'

describe('Stage 201.79 catalog map rail filter', () => {
  const phuketBbox = { south: 7.7, north: 8.2, west: 98.2, east: 98.5 }
  const listings = [
    { id: 'phuket-1', lat: 7.88, lng: 98.39, title: 'Phuket' },
    { id: 'chita-1', lat: 52.03, lng: 113.5, title: 'Chita' },
    { id: 'no-coords', title: 'Unknown' },
  ]

  it('pointInCatalogMapBbox', () => {
    assert.equal(pointInCatalogMapBbox(phuketBbox, 7.88, 98.39), true)
    assert.equal(pointInCatalogMapBbox(phuketBbox, 52.03, 113.5), false)
  })

  it('filters by pin ids (Chita out when only Phuket pins)', () => {
    const rail = filterCatalogRailListingsForMapViewport(listings, {
      pins: [{ id: 'phuket-1' }],
      viewportBbox: phuketBbox,
    })
    assert.deepEqual(
      rail.map((l) => l.id),
      ['phuket-1'],
    )
  })

  it('keeps selected even if not in pin list', () => {
    const rail = filterCatalogRailListingsForMapViewport(listings, {
      pins: [{ id: 'phuket-1' }],
      selectedListingId: 'chita-1',
    })
    assert.deepEqual(
      rail.map((l) => l.id).sort(),
      ['chita-1', 'phuket-1'],
    )
  })

  it('falls back to bbox when pins empty', () => {
    const rail = filterCatalogRailListingsForMapViewport(listings, {
      pins: [],
      viewportBbox: phuketBbox,
    })
    assert.deepEqual(
      rail.map((l) => l.id),
      ['phuket-1'],
    )
  })

  it('keeps full page while pins/bbox not ready', () => {
    const rail = filterCatalogRailListingsForMapViewport(listings, {
      pins: [],
      viewportBbox: null,
    })
    assert.equal(rail.length, 3)
  })
})
