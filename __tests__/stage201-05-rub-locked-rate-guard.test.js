/**
 * Stage 201.05 — ledger RUB reporting uses locked booking FX only (never live mid).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-05-rub-locked-rate-guard.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  buildRubPostingFields,
  resolveLockedRubToThbRate,
} from '../lib/services/ledger/ledger-shared.js'

const LEGS_V2 = {
  ledgerV2: true,
  guestTotalThb: 1000,
  ruFeeThb: 70,
  krFeeThb: 80,
  fxMarkupThb: 30,
}

describe('Stage 201.05 — locked RUB rate for ledger reporting', () => {
  it('uses bookings.exchange_rate when currency is RUB', async () => {
    const booking = { id: 'b1', currency: 'RUB', exchange_rate: 0.4, listing_currency: 'THB' }
    assert.equal(resolveLockedRubToThbRate(booking), 0.4)
    const fields = await buildRubPostingFields(booking, LEGS_V2)
    assert.equal(fields.amount_total_rub, 2500)
    assert.equal(fields.ru_fee_income_rub, 175)
  })

  it('uses snapshot fx_raw_rate_to_thb when column is missing', async () => {
    const booking = {
      id: 'b2',
      currency: 'RUB',
      pricing_snapshot: {
        v: 2,
        final_breakdown: {
          fx_raw_rate_to_thb: 0.5,
          total_guest_brutto: { amount: 2000, currency: 'RUB' },
        },
      },
    }
    assert.equal(resolveLockedRubToThbRate(booking), 0.5)
    const fields = await buildRubPostingFields(booking, LEGS_V2)
    assert.equal(fields.amount_total_rub, 2000)
  })

  it('skips RUB columns when RUB booking has no locked rate (no live mid)', async () => {
    const booking = { id: 'b3', currency: 'RUB', exchange_rate: null, pricing_snapshot: { v: 2 } }
    assert.equal(resolveLockedRubToThbRate(booking), null)
    const fields = await buildRubPostingFields(booking, LEGS_V2)
    assert.deepEqual(fields, {})
  })

  it('does not invent RUB from live rates for THB-pay bookings', async () => {
    const booking = { id: 'b4', currency: 'THB', exchange_rate: 1, listing_currency: 'THB' }
    assert.equal(resolveLockedRubToThbRate(booking), null)
    const fields = await buildRubPostingFields(booking, LEGS_V2)
    assert.deepEqual(fields, {})
  })
})
