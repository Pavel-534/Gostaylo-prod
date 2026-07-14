import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isPartnerWithdrawDisabled } from '../lib/partner/partner-withdraw-eligibility.js'

const baseOk = {
  summaryLoading: false,
  payoutPreviewLoading: false,
  partnerId: 'partner-1',
  partnerProfileVerified: true,
  hasProfile: true,
  payoutPreview: { finalAmountThb: 1500 },
}

describe('isPartnerWithdrawDisabled', () => {
  it('allows withdraw when all gates pass and balance > 0', () => {
    assert.equal(isPartnerWithdrawDisabled(baseOk), false)
  })

  it('blocks when finalAmountThb is zero', () => {
    assert.equal(
      isPartnerWithdrawDisabled({ ...baseOk, payoutPreview: { finalAmountThb: 0 } }),
      true,
    )
  })

  it('blocks when finalAmountThb is missing or negative', () => {
    assert.equal(isPartnerWithdrawDisabled({ ...baseOk, payoutPreview: {} }), true)
    assert.equal(
      isPartnerWithdrawDisabled({ ...baseOk, payoutPreview: { finalAmountThb: -10 } }),
      true,
    )
  })

  it('blocks when partner profile is not verified', () => {
    assert.equal(
      isPartnerWithdrawDisabled({ ...baseOk, partnerProfileVerified: false }),
      true,
    )
    assert.equal(
      isPartnerWithdrawDisabled({ ...baseOk, partnerProfileVerified: null }),
      true,
    )
  })

  it('blocks when payout profile is missing', () => {
    assert.equal(isPartnerWithdrawDisabled({ ...baseOk, hasProfile: false }), true)
  })

  it('blocks while summary or preview is loading', () => {
    assert.equal(isPartnerWithdrawDisabled({ ...baseOk, summaryLoading: true }), true)
    assert.equal(isPartnerWithdrawDisabled({ ...baseOk, payoutPreviewLoading: true }), true)
  })

  it('blocks when partnerId is absent', () => {
    assert.equal(isPartnerWithdrawDisabled({ ...baseOk, partnerId: null }), true)
  })
})
