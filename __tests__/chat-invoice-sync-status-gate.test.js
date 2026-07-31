/**
 * AUDIT_03 C3.9 — chat invoice sync status gate (pure).
 * Run: node --test __tests__/chat-invoice-sync-status-gate.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

const BLOCKED = new Set(['PAID_ESCROW', 'CHECKED_IN', 'THAWED', 'READY_FOR_PAYOUT', 'COMPLETED'])

function isChatInvoiceSyncBlockedByBookingStatus(status) {
  return BLOCKED.has(String(status || '').toUpperCase())
}

describe('chat invoice sync status gate', () => {
  it('blocks PAID_ESCROW', () => {
    assert.equal(isChatInvoiceSyncBlockedByBookingStatus('PAID_ESCROW'), true)
  })

  it('blocks COMPLETED', () => {
    assert.equal(isChatInvoiceSyncBlockedByBookingStatus('COMPLETED'), true)
  })

  it('allows INQUIRY and AWAITING_PAYMENT', () => {
    assert.equal(isChatInvoiceSyncBlockedByBookingStatus('INQUIRY'), false)
    assert.equal(isChatInvoiceSyncBlockedByBookingStatus('AWAITING_PAYMENT'), false)
  })
})
