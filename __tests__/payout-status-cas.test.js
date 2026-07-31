/**
 * Run: node --test __tests__/payout-status-cas.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')

describe('payout-status-cas', () => {
  it('prefers body expectedUpdatedAt', async () => {
    const { resolvePayoutCasUpdatedAt, interpretPayoutCasUpdate } = await import(
      '../lib/admin/payout-status-cas.js'
    )
    assert.equal(
      resolvePayoutCasUpdatedAt({ expectedUpdatedAt: '2026-01-01T00:00:00.000Z' }, { updated_at: 'old' }),
      '2026-01-01T00:00:00.000Z',
    )
    const miss = interpretPayoutCasUpdate({ data: null, error: null }, 't1')
    assert.equal(miss.code, 'CONCURRENT_MODIFICATION')
    assert.equal(miss.status, 409)
    const ok = interpretPayoutCasUpdate({ data: { id: 'p1' }, error: null }, 't1')
    assert.equal(ok.ok, true)
  })
})
