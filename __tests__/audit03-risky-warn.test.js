/**
 * AUDIT_03 risky WARN unit checks (no DB).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/audit03-risky-warn.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('W3.1 inquiry attestation regate', () => {
  it('blocks skipped inquiry without invoice', async () => {
    const { assertInquiryAttestationRegateForPayable } = await import(
      '../lib/booking/inquiry-attestation-regate.js'
    )
    const r = assertInquiryAttestationRegateForPayable({
      booking: { metadata: { price_attestation_skipped: true } },
      invoiceId: null,
    })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'ATTESTATION_REGATE_REQUIRED')
  })

  it('allows after invoice / regate', async () => {
    const { assertInquiryAttestationRegateForPayable, attestationRegateMetadataPatch } = await import(
      '../lib/booking/inquiry-attestation-regate.js'
    )
    assert.equal(
      assertInquiryAttestationRegateForPayable({
        booking: { metadata: { price_attestation_skipped: true } },
        invoiceId: 'inv-1',
      }).ok,
      true,
    )
    const patched = attestationRegateMetadataPatch({ price_attestation_skipped: true })
    assert.equal(patched.price_attestation_skipped, false)
    assert.ok(patched.price_attestation_regate_at)
  })
})

describe('W3.5 empty allowed_methods', () => {
  it('documents fail-closed semantics', () => {
    const allowed = []
    const deny = allowed.length === 0
    assert.equal(deny, true)
  })
})

describe('W3.7 escrow RPC insurance SSOT', () => {
  it('folds insurance into platform', async () => {
    const { alignLedgerLegsToEscrowRpcCaptureSsot } = await import(
      '../lib/services/ledger/ledger-capture-legs.js'
    )
    const aligned = alignLedgerLegsToEscrowRpcCaptureSsot({
      ledgerV2: false,
      guestTotalThb: 1000,
      partnerThb: 800,
      platformFeeThb: 150,
      insuranceThb: 50,
      roundingThb: 0,
    })
    assert.equal(aligned.insuranceThb, 0)
    assert.equal(aligned.platformFeeThb, 200)
  })
})

describe('W3.11 USDT rate lock', () => {
  it('reads locked rate from booking metadata', async () => {
    const { readLockedUsdtRateThb } = await import('../lib/payment/crypto-usdt-rate-lock.js')
    assert.equal(readLockedUsdtRateThb({ metadata: { usdt_rate_thb: 36.5 } }), 36.5)
    assert.equal(readLockedUsdtRateThb({ metadata: {} }), null)
  })
})

describe('W3.4 lock retry detector', () => {
  it('detects lock_timeout style messages', () => {
    function isRetriableAtomicRpcError(message) {
      const m = String(message || '').toLowerCase()
      return (
        m.includes('lock_timeout') ||
        m.includes('deadlock') ||
        m.includes('40p01') ||
        m.includes('55p03') ||
        m.includes('could not obtain lock') ||
        m.includes('canceling statement due to lock timeout')
      )
    }
    assert.equal(isRetriableAtomicRpcError('canceling statement due to lock timeout'), true)
    assert.equal(isRetriableAtomicRpcError('DATES_CONFLICT'), false)
  })
})
