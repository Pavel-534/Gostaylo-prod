/**
 * ADR-182 — fee policy host commission resolver
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/pricing-fee-policy.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('resolveHostCommissionPercentFromGeneral (ADR-182 / Stage 183)', () => {
  it('uses dedicated hostCommissionPercent when > 0', async () => {
    const { resolveHostCommissionPercentFromGeneral } = await import(
      '@/lib/services/pricing/pricing-fee-policy.js'
    )
    assert.equal(
      resolveHostCommissionPercentFromGeneral({
        hostCommissionPercent: 12,
        defaultCommissionRate: 15,
      }),
      12,
    )
  })

  it('explicit hostCommissionPercent 0 wins over legacy defaultCommissionRate 15', async () => {
    const { resolveHostCommissionPercentFromGeneral } = await import(
      '@/lib/services/pricing/pricing-fee-policy.js'
    )
    assert.equal(
      resolveHostCommissionPercentFromGeneral({
        hostCommissionPercent: 0,
        defaultCommissionRate: 15,
      }),
      0,
    )
  })

  it('returns explicit 0 when both keys are 0 (launch / YooKassa)', async () => {
    const { resolveHostCommissionPercentFromGeneral } = await import(
      '@/lib/services/pricing/pricing-fee-policy.js'
    )
    assert.equal(
      resolveHostCommissionPercentFromGeneral({
        hostCommissionPercent: 0,
        defaultCommissionRate: 0,
      }),
      0,
    )
  })

  it('uses legacy defaultCommissionRate when hostCommissionPercent missing', async () => {
    const { resolveHostCommissionPercentFromGeneral } = await import(
      '@/lib/services/pricing/pricing-fee-policy.js'
    )
    assert.equal(resolveHostCommissionPercentFromGeneral({ defaultCommissionRate: 15 }), 15)
  })
})

describe('resolveGuestServiceFeePercentFromGeneral (Stage 183)', () => {
  it('reads guestServiceFeePercent and falls back to platform default 15', async () => {
    const { resolveGuestServiceFeePercentFromGeneral } = await import(
      '@/lib/services/pricing/pricing-fee-policy.js'
    )
    assert.equal(resolveGuestServiceFeePercentFromGeneral({ guestServiceFeePercent: 12 }), 12)
    assert.equal(resolveGuestServiceFeePercentFromGeneral({}), 15)
    assert.equal(
      resolveGuestServiceFeePercentFromGeneral({ serviceFeePercent: 8 }),
      8,
    )
  })
})
