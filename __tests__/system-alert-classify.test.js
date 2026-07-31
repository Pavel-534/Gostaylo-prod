/**
 * Run: node --test __tests__/system-alert-classify.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('classifySystemAlert', () => {
  it('splits money classes', async () => {
    const { classifySystemAlert } = await import('../lib/services/system-alert-notify.js')
    assert.equal(classifySystemAlert('PRICE_MISMATCH on listing'), 'PRICE_TAMPERING')
    assert.equal(classifySystemAlert('Webhook: crypto/confirm failed'), 'CRYPTO_WEBHOOK')
    assert.equal(classifySystemAlert('ledger drift on payout'), 'FINANCE')
    assert.equal(classifySystemAlert('hello'), 'GENERAL')
  })
})
