import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  convertAmbassadorDisplayToThb,
  convertAmbassadorDisplayToThbGuarded,
  convertThbToAmbassadorDisplayRounded,
} from '../lib/pricing/ambassador-display-amount.js'

const MIN_PAYOUT_THB = 1000
const RATE_MAP = { THB: 1, RUB: 0.356 }

describe('ambassador-display-amount withdrawal guard (Stage 188.3)', () => {
  it('snaps exact min display amount to min THB even when raw FX is below floor', () => {
    const minDisplay = convertThbToAmbassadorDisplayRounded(MIN_PAYOUT_THB, 'RUB', RATE_MAP)
    assert.equal(minDisplay, 2800)

    const rawThb = convertAmbassadorDisplayToThb(minDisplay, 'RUB', RATE_MAP)
    assert.ok(rawThb < MIN_PAYOUT_THB, 'raw reverse FX can fall below 1000 THB')

    const guarded = convertAmbassadorDisplayToThbGuarded(minDisplay, 'RUB', RATE_MAP, MIN_PAYOUT_THB)
    assert.equal(guarded, MIN_PAYOUT_THB)
  })

  it('snaps within 2% tolerance below min THB', () => {
    const guarded = convertAmbassadorDisplayToThbGuarded(2790, 'RUB', RATE_MAP, MIN_PAYOUT_THB)
    assert.equal(guarded, MIN_PAYOUT_THB)
  })

  it('does not snap amounts clearly below minimum', () => {
    const guarded = convertAmbassadorDisplayToThbGuarded(2500, 'RUB', RATE_MAP, MIN_PAYOUT_THB)
    assert.ok(guarded < MIN_PAYOUT_THB)
    assert.ok(guarded > 0)
  })

  it('THB path: exact min display equals min THB', () => {
    const guarded = convertAmbassadorDisplayToThbGuarded(1000, 'THB', RATE_MAP, MIN_PAYOUT_THB)
    assert.equal(guarded, MIN_PAYOUT_THB)
  })
})
