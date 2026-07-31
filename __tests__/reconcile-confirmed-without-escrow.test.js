/**
 * AUDIT_03 C3.4 — bookingNeedsEscrowAfterConfirmedPayment (pure).
 * Run: node --test __tests__/reconcile-confirmed-without-escrow.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const ESCROW_DONE = new Set(['PAID_ESCROW', 'CHECKED_IN', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED'])

function bookingNeedsEscrowAfterConfirmedPayment(bookingStatus) {
  return !ESCROW_DONE.has(String(bookingStatus || '').toUpperCase())
}

describe('reconcile confirmed without escrow', () => {
  it('needs escrow for AWAITING_PAYMENT', () => {
    assert.equal(bookingNeedsEscrowAfterConfirmedPayment('AWAITING_PAYMENT'), true)
  })

  it('does not need escrow for PAID_ESCROW', () => {
    assert.equal(bookingNeedsEscrowAfterConfirmedPayment('PAID_ESCROW'), false)
  })

  it('does not need escrow for COMPLETED', () => {
    assert.equal(bookingNeedsEscrowAfterConfirmedPayment('COMPLETED'), false)
  })
})
