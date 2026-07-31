/**
 * AUDIT_03 C3.1 — crypto confirm ignores body.expectedAmount (pure).
 * Run: node --test __tests__/crypto-webhook-expected-amount-ssot.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

function resolveExpectedUsdt({ bodyExpected, dbExpected }) {
  // Body must never override DB/intent SSOT
  void bodyExpected
  const n = Number(dbExpected)
  return Number.isFinite(n) && n > 0 ? n : null
}

describe('crypto webhook expectedAmount SSOT', () => {
  it('ignores low body amount when DB expects full', () => {
    assert.equal(resolveExpectedUsdt({ bodyExpected: 1, dbExpected: 250 }), 250)
  })

  it('rejects when DB amount missing', () => {
    assert.equal(resolveExpectedUsdt({ bodyExpected: 999, dbExpected: null }), null)
  })
})
