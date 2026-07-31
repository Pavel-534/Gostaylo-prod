/**
 * AUDIT_03 C3.5 — partner payout claim response mapping (no DB).
 * Run: node --test __tests__/partner-payout-claim-map.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

function mapClaim(claim, fallbackAvailable) {
  if (!claim?.claimed) {
    const reason = String(claim?.reason || 'INSUFFICIENT_BALANCE')
    return {
      success: false,
      code: reason === 'INSUFFICIENT_BALANCE' ? 'INSUFFICIENT_BALANCE' : reason,
      availableThb: claim?.available_thb ?? fallbackAvailable,
    }
  }
  return { success: true, payoutId: claim.payout_id }
}

describe('partner payout claim map', () => {
  it('maps insufficient to INSUFFICIENT_BALANCE', () => {
    const r = mapClaim({ claimed: false, reason: 'INSUFFICIENT_BALANCE', available_thb: 10 }, 99)
    assert.equal(r.success, false)
    assert.equal(r.code, 'INSUFFICIENT_BALANCE')
    assert.equal(r.availableThb, 10)
  })

  it('maps success', () => {
    const r = mapClaim({ claimed: true, reason: 'OK', payout_id: 'payout-abc' }, 0)
    assert.equal(r.success, true)
    assert.equal(r.payoutId, 'payout-abc')
  })
})
