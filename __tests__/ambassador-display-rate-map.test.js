import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  hasAmbassadorFxRate,
  mergeAmbassadorDisplayRateMaps,
} from '../lib/pricing/ambassador-display-rate-map.js'

describe('ambassador-display-rate-map', () => {
  it('merge prefers mid rate over retail for same currency', () => {
    const merged = mergeAmbassadorDisplayRateMaps(
      { THB: 1, RUB: 0.356 },
      { THB: 1, RUB: 0.35 },
    )
    assert.equal(merged.RUB, 0.356)
  })

  it('merge falls back to retail when mid lacks currency', () => {
    const merged = mergeAmbassadorDisplayRateMaps(
      { THB: 1 },
      { THB: 1, RUB: 0.35, USD: 0.028 },
    )
    assert.equal(merged.RUB, 0.35)
    assert.equal(merged.USD, 0.028)
  })

  it('hasAmbassadorFxRate is true when normalized rate exists', () => {
    assert.equal(hasAmbassadorFxRate({ THB: 1, RUB: 0.35 }, 'RUB'), true)
    assert.equal(hasAmbassadorFxRate({ THB: 1 }, 'RUB'), false)
  })
})
