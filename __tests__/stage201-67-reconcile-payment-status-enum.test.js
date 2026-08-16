/**
 * Stage 201.67 — reconcile uses DB enum COMPLETED (not CONFIRMED).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-67-reconcile-payment-status-enum.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.67 — reconcile payment_status enum', () => {
  it('legacy reconcile queries COMPLETED, not CONFIRMED', () => {
    const src = read('lib/payment/reconcile-confirmed-without-escrow.js')
    assert.match(src, /LEGACY_PAID_PAYMENT_STATUS\s*=\s*'COMPLETED'/)
    assert.match(src, /\.eq\('status',\s*LEGACY_PAID_PAYMENT_STATUS\)/)
    assert.doesNotMatch(src, /\.eq\('status',\s*'CONFIRMED'\)/)
  })

  it('PaymentsV3 confirmPayment writes COMPLETED to match DB enum', () => {
    const src = read('lib/services/payments-v3.service.js')
    assert.match(src, /status:\s*PaymentStatus\.COMPLETED/)
    assert.match(src, /DB enum has COMPLETED, not CONFIRMED/)
  })
})
