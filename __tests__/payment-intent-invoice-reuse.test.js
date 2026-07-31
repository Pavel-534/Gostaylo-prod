/**
 * AUDIT_03 C3.8 — intent reuse amount match (pure).
 * Run: node --test __tests__/payment-intent-invoice-reuse.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

function shouldReuseIntent({ invoice, invoiceId, intentAmount, expectedAmountThb, intentInvoiceId }) {
  const amountMatches = invoice
    ? Number.isFinite(expectedAmountThb) && expectedAmountThb > 0 && intentAmount === expectedAmountThb
    : intentAmount === expectedAmountThb
  const invoiceIdMatches = !invoiceId || String(intentInvoiceId || '') === String(invoiceId)
  return Boolean(invoiceIdMatches && amountMatches)
}

describe('invoice sticky intent reuse', () => {
  it('rejects reuse when invoice amount changed', () => {
    assert.equal(
      shouldReuseIntent({
        invoice: { id: 'inv1' },
        invoiceId: 'inv1',
        intentAmount: 1000,
        expectedAmountThb: 2000,
        intentInvoiceId: 'inv1',
      }),
      false,
    )
  })

  it('reuses when amount and invoice_id match', () => {
    assert.equal(
      shouldReuseIntent({
        invoice: { id: 'inv1' },
        invoiceId: 'inv1',
        intentAmount: 2000,
        expectedAmountThb: 2000,
        intentInvoiceId: 'inv1',
      }),
      true,
    )
  })

  it('does not treat Boolean(invoice) as match', () => {
    assert.equal(
      shouldReuseIntent({
        invoice: { id: 'inv1' },
        invoiceId: 'inv1',
        intentAmount: 1,
        expectedAmountThb: 999,
        intentInvoiceId: 'inv1',
      }),
      false,
    )
  })
})
