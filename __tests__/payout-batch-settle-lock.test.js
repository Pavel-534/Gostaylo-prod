/**
 * Settle lock meta helper (no DB).
 * Run: node --test __tests__/payout-batch-settle-lock.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('withSettleLockMeta', () => {
  it('preserves lock token across metadata merges', async () => {
    const { withSettleLockMeta } = await import(
      '../lib/services/payout-batch/payout-batch-settle-lock.js'
    )
    const merged = withSettleLockMeta(
      { settled_by: 'admin-1', ledger_errors: null },
      {
        settleInProgressAt: '2026-07-31T12:00:00.000Z',
        settleLockOwner: 'admin-1',
        settleLockToken: 'tok-abc',
      },
    )
    assert.equal(merged.settle_lock_token, 'tok-abc')
    assert.equal(merged.settle_lock_owner, 'admin-1')
    assert.equal(merged.settled_by, 'admin-1')
  })

  it('no-ops without token', async () => {
    const { withSettleLockMeta } = await import(
      '../lib/services/payout-batch/payout-batch-settle-lock.js'
    )
    const merged = withSettleLockMeta({ a: 1 }, {})
    assert.deepEqual(merged, { a: 1 })
  })

  it('exports 1800s TTL constant', async () => {
    const { PAYOUT_BATCH_SETTLE_LOCK_TTL_SEC } = await import(
      '../lib/services/payout-batch/payout-batch-settle-lock.js'
    )
    assert.equal(PAYOUT_BATCH_SETTLE_LOCK_TTL_SEC, 1800)
  })
})
