/**
 * AUDIT_03 C3.3 — amount resolution for Tron verify (pure).
 * Run: node --test __tests__/tron-amount-unresolved.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const AMOUNT_TOLERANCE = 0.005

function evaluateTronAmountGate(txAmount, expectedAmountUsdt) {
  const expected =
    expectedAmountUsdt != null && String(expectedAmountUsdt).trim() !== ''
      ? Number(expectedAmountUsdt)
      : null
  const hasExpected = Number.isFinite(expected) && expected > 0
  const amountResolved = Number.isFinite(txAmount) && txAmount > 0

  if (hasExpected && !amountResolved) {
    return { success: false, status: 'AMOUNT_UNRESOLVED', reason: 'AMOUNT_UNRESOLVED' }
  }
  if (!hasExpected) {
    return { success: true, status: 'SKIP_AMOUNT_CHECK', amountStatus: null }
  }
  const minAcceptable = expected * (1 - AMOUNT_TOLERANCE)
  if (txAmount < minAcceptable) {
    return { success: false, status: 'UNDERPAID', amountStatus: 'UNDERPAID' }
  }
  return { success: true, status: 'SUCCESS', amountStatus: txAmount >= expected ? 'FULL' : 'ACCEPTABLE' }
}

describe('tron amount unresolved fail-closed', () => {
  it('rejects null amount when expected set', () => {
    const r = evaluateTronAmountGate(null, 100)
    assert.equal(r.status, 'AMOUNT_UNRESOLVED')
    assert.equal(r.success, false)
  })

  it('rejects zero amount when expected set (no skip underpay)', () => {
    const r = evaluateTronAmountGate(0, 100)
    assert.equal(r.status, 'AMOUNT_UNRESOLVED')
    assert.equal(r.success, false)
  })

  it('rejects NaN', () => {
    const r = evaluateTronAmountGate(Number.NaN, 50)
    assert.equal(r.status, 'AMOUNT_UNRESOLVED')
  })

  it('underpays when parsed amount too low', () => {
    const r = evaluateTronAmountGate(50, 100)
    assert.equal(r.status, 'UNDERPAID')
  })

  it('accepts full amount', () => {
    const r = evaluateTronAmountGate(100, 100)
    assert.equal(r.success, true)
    assert.equal(r.status, 'SUCCESS')
  })
})
