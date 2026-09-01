/**
 * Stage 202.29 — keyboard layout geo search variants.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/keyboard-layout-query.test.js
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getKeyboardLayoutQueryVariants,
  haystackMatchesGeoQuery,
  pickGeocodeSearchQuery,
} from '@/lib/geo/keyboard-layout-query.js'

test('hjcc maps to росс for Russia country search', () => {
  const variants = getKeyboardLayoutQueryVariants('hjcc')
  assert.ok(variants.includes('росс'))
  assert.ok(haystackMatchesGeoQuery('Россия RU', 'hjcc'))
})

test('росс direct match still works', () => {
  assert.ok(haystackMatchesGeoQuery('Россия RU', 'росс'))
})

test('pickGeocodeSearchQuery prefers Cyrillic swap on ru lang', () => {
  assert.equal(pickGeocodeSearchQuery('hjcc', 'ru'), 'росс')
  assert.equal(pickGeocodeSearchQuery('Россия', 'ru'), 'Россия')
})

test('pickGeocodeSearchQuery leaves en UI unchanged', () => {
  assert.equal(pickGeocodeSearchQuery('hjcc', 'en'), 'hjcc')
})
