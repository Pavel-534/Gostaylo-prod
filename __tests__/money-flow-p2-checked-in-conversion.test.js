import test from 'node:test'
import assert from 'node:assert/strict'
import { isSystemBookingStatusTransitionAllowed } from '../lib/booking/status-transitions.js'
import {
  ESCROW_THAW_SOURCE_STATUSES,
  isEscrowThawSourceStatus,
} from '../lib/booking/status-sets.js'
import { buildTreasuryConversionIds } from '../lib/admin/treasury-conversion-idempotency.js'

test('system FSM allows CHECKED_IN → THAWED', () => {
  assert.equal(isSystemBookingStatusTransitionAllowed('CHECKED_IN', 'THAWED'), true)
  assert.equal(isSystemBookingStatusTransitionAllowed('CHECKED_IN', 'READY_FOR_PAYOUT'), false)
})

test('thaw source statuses include PAID_ESCROW and CHECKED_IN', () => {
  assert.deepEqual([...ESCROW_THAW_SOURCE_STATUSES], ['PAID_ESCROW', 'CHECKED_IN'])
  assert.equal(isEscrowThawSourceStatus('CHECKED_IN'), true)
  assert.equal(isEscrowThawSourceStatus('THAWED'), false)
})

test('treasury conversion: client key is stable', () => {
  const a = buildTreasuryConversionIds({
    clientKey: 'abc-123',
    operationType: 'BANK',
    fromCurrency: 'THB',
    toCurrency: 'RUB',
    amountFrom: 100,
    amountTo: 250,
    rateUsed: 0.4,
    conversionFeeThb: 1,
    conversionLossThb: 0,
  })
  const b = buildTreasuryConversionIds({
    clientKey: 'abc-123',
    operationType: 'BANK',
    fromCurrency: 'THB',
    toCurrency: 'RUB',
    amountFrom: 999,
    amountTo: 1,
    rateUsed: 9,
    conversionFeeThb: 9,
    conversionLossThb: 9,
  })
  assert.equal(a.idempotencyKey, b.idempotencyKey)
  assert.equal(a.conversionId, b.conversionId)
  assert.equal(a.source, 'client')
})

test('treasury conversion: external tx ref preferred over fingerprint', () => {
  const a = buildTreasuryConversionIds({
    externalTxReference: 'TX-99',
    operationType: 'BANK',
    fromCurrency: 'THB',
    toCurrency: 'RUB',
    amountFrom: 100,
    amountTo: 250,
    rateUsed: 0.4,
    conversionFeeThb: 1,
    conversionLossThb: 0,
  })
  assert.match(a.idempotencyKey, /^treasury_conversion:ext:TX-99$/)
  assert.equal(a.source, 'external_tx')
})

test('treasury conversion: same-day fingerprint dedupes', () => {
  const base = {
    operationType: 'BANK',
    fromCurrency: 'THB',
    toCurrency: 'RUB',
    amountFrom: 100.004,
    amountTo: 250,
    rateUsed: 0.4,
    conversionFeeThb: 1,
    conversionLossThb: 0.5,
    createdBy: 'admin-1',
    dayUtc: '2026-08-01',
  }
  const a = buildTreasuryConversionIds(base)
  const b = buildTreasuryConversionIds({ ...base, amountFrom: 100.001 })
  assert.equal(a.idempotencyKey, b.idempotencyKey)
  assert.equal(a.source, 'fingerprint')
  const c = buildTreasuryConversionIds({ ...base, dayUtc: '2026-08-02' })
  assert.notEqual(a.idempotencyKey, c.idempotencyKey)
})
