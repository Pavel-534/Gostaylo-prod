/**
 * Stage 202.4 — sticky/compact «Куда?» must keep localized labels (not TH-PHK / Th Phk).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-4-where-sticky-label.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isLikelyRawWhereSlugLabel,
  resolveGuestWhereInputLabel,
  resolveWhereDisplayLabelOrFallback,
} from '../lib/locations/resolve-where-display-label.js'
import { getOptionLabel } from '../lib/locations/where-options.js'

describe('Stage 202.4 where sticky / compact labels', () => {
  it('resolves TH-PHK and chita to Russian display names', () => {
    assert.equal(resolveWhereDisplayLabelOrFallback('TH-PHK', 'ru'), 'Пхукет')
    assert.equal(resolveWhereDisplayLabelOrFallback('chita', 'ru'), 'Чита')
    assert.equal(resolveGuestWhereInputLabel('TH-PHK', [], 'ru'), 'Пхукет')
    assert.equal(resolveGuestWhereInputLabel('chita', [], 'ru'), 'Чита')
  })

  it('treats title-cased geo codes as raw labels', () => {
    assert.equal(isLikelyRawWhereSlugLabel('Th Phk', 'TH-PHK'), true)
    assert.equal(isLikelyRawWhereSlugLabel('TH-PHK', 'TH-PHK'), true)
    assert.equal(isLikelyRawWhereSlugLabel('Пхукет', 'TH-PHK'), false)
  })

  it('does not fall back getOptionLabel to raw value', () => {
    assert.equal(getOptionLabel([], 'TH-PHK'), '')
    assert.equal(getOptionLabel([{ value: 'TH-PHK', label: 'Пхукет' }], 'TH-PHK'), 'Пхукет')
  })

  it('prefers SSOT over title-cased option label', () => {
    const opts = [{ value: 'TH-PHK', label: 'Th Phk' }]
    assert.equal(resolveGuestWhereInputLabel('TH-PHK', opts, 'ru'), 'Пхукет')
  })
})
