/**
 * Stage 201.08 — cleanup must not treat live `lst-villa-*` seeds as E2E garbage.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-08-test-listing-cleanup-villa-id.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isTestListingId,
  isAggressiveE2eListingCandidate,
} from '../lib/e2e/test-listing-cleanup.js'

describe('Stage 201.08 — listing cleanup id heuristics', () => {
  it('does not flag live villa/yacht seed ids', () => {
    assert.equal(isTestListingId('lst-villa-1773578825137'), false)
    assert.equal(isTestListingId('lst-yacht-1773578825136'), false)
    assert.equal(
      isAggressiveE2eListingCandidate({
        id: 'lst-villa-1773578825137',
        title: 'Beachfront Paradise Villa - Rawai',
        description: '',
      }),
      false,
    )
  })

  it('still flags explicit E2E / lst-test / lst-e2e ids', () => {
    assert.equal(isTestListingId('lst-test-final-1772285152'), true)
    assert.equal(isTestListingId('lst-e2e-stage72-cashflow'), true)
    assert.equal(
      isAggressiveE2eListingCandidate({
        id: 'lst-abc',
        title: '[E2E_TEST_DATA] Wizard geo',
        description: '',
      }),
      true,
    )
  })
})
