/**
 * Stage 201.82 — where display labels + supply-first popular.
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isLikelyRawWhereSlugLabel,
  resolveWhereDisplayLabel,
  resolveWhereDisplayLabelOrFallback,
} from '../lib/locations/resolve-where-display-label.js'
import { getDestinationLabel } from '../lib/locations/popular-destinations.js'
import { getStaticLocationsSeed } from '../lib/locations/locations-seed.js'
import { getPopularDestinationsFallback } from '../lib/api/popular-destinations-client.js'

describe('Stage 201.82 where discovery labels', () => {
  it('resolves chita to Чита in Russian', () => {
    assert.equal(resolveWhereDisplayLabel('chita', 'ru'), 'Чита')
    assert.equal(resolveWhereDisplayLabelOrFallback('chita', 'ru'), 'Чита')
    assert.equal(getDestinationLabel('chita', 'ru'), null)
  })

  it('detects raw slug recent labels', () => {
    assert.equal(isLikelyRawWhereSlugLabel('chita', 'chita'), true)
    assert.equal(isLikelyRawWhereSlugLabel('Чита', 'chita'), false)
  })

  it('guest static seed is empty (no Phuket district dump)', () => {
    const seed = getStaticLocationsSeed()
    assert.deepEqual(seed.cities, [])
    assert.deepEqual(seed.allDistricts, [])
  })

  it('popular offline fallback is empty (no ghost cities)', () => {
    assert.deepEqual(getPopularDestinationsFallback('ru'), [])
  })
})
