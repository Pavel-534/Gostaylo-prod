import test from 'node:test'
import assert from 'node:assert/strict'
import {
  resolveEscrowThawOps,
  resolvePayoutBatchPoolsOps,
  resolveLedgerShadowOps,
} from '../lib/ops/ops-job-outcome.js'
import { isOpsSuccessStale, pickLatestSuccessAtByJob } from '../lib/ops/stale-cron-monitor.js'

test('escrow-thaw: zero processed is success', () => {
  const ops = resolveEscrowThawOps({ success: true, processed: 0 })
  assert.equal(ops.status, 'success')
  assert.equal(ops.errorMessage, null)
})

test('escrow-thaw: freeze_lookup_failed is error', () => {
  const ops = resolveEscrowThawOps({
    success: false,
    error: 'freeze_lookup_failed',
    processed: 2,
  })
  assert.equal(ops.status, 'error')
  assert.match(ops.errorMessage, /freeze_lookup_failed/)
})

test('payout-batch-pools: empty pool is success', () => {
  const ops = resolvePayoutBatchPoolsOps({
    batchId: null,
    itemCount: 0,
    message: 'no_ready_bookings',
  })
  assert.equal(ops.status, 'success')
})

test('payout-batch-pools: not_pool_day is soft success', () => {
  const ops = resolvePayoutBatchPoolsOps({
    error: 'not_pool_day',
    message: 'Payout pools are scheduled Mon/Thu only',
  })
  assert.equal(ops.status, 'success')
  assert.equal(ops.stats.soft_skip, 'not_pool_day')
})

test('payout-batch-pools: freeze_lookup_failed is error', () => {
  const ops = resolvePayoutBatchPoolsOps({
    error: 'freeze_lookup_failed',
    message: 'blocked',
    itemCount: 0,
  })
  assert.equal(ops.status, 'error')
})

test('ledger-shadow: zero partners is success', () => {
  const ops = resolveLedgerShadowOps({
    compared: 0,
    errors: 0,
    driftCount: 0,
    zeroDrift: true,
  })
  assert.equal(ops.status, 'success')
})

test('ledger-shadow: drift alone stays success', () => {
  const ops = resolveLedgerShadowOps({
    compared: 3,
    errors: 0,
    driftCount: 2,
    zeroDrift: false,
  })
  assert.equal(ops.status, 'success')
})

test('ledger-shadow: compare errors are ops error', () => {
  const ops = resolveLedgerShadowOps({
    compared: 1,
    errors: 4,
    driftCount: 0,
    zeroDrift: false,
  })
  assert.equal(ops.status, 'error')
})

test('stale: hourly >2h and daily >26h', () => {
  const now = Date.parse('2026-08-01T12:00:00.000Z')
  const hour = 60 * 60 * 1000
  assert.equal(isOpsSuccessStale(new Date(now - 1.5 * hour).toISOString(), now, 2 * hour), false)
  assert.equal(isOpsSuccessStale(new Date(now - 2.1 * hour).toISOString(), now, 2 * hour), true)
  assert.equal(isOpsSuccessStale(new Date(now - 25 * hour).toISOString(), now, 26 * hour), false)
  assert.equal(isOpsSuccessStale(new Date(now - 27 * hour).toISOString(), now, 26 * hour), true)
  assert.equal(isOpsSuccessStale(null, now, 2 * hour), true)
})

test('Stage 202.11: pickLatest keeps daily job even when hourly flood is newer', () => {
  const jobs = ['reconcile-yookassa-pending', 'ledger_shadow_reconcile']
  const rows = []
  for (let i = 0; i < 100; i++) {
    rows.push({
      job_name: 'reconcile-yookassa-pending',
      started_at: `2026-08-27T1${String(i % 10).padStart(1, '0')}:00:00.000Z`,
      finished_at: `2026-08-27T1${String(i % 10).padStart(1, '0')}:00:01.000Z`,
    })
  }
  // Shared limit(80) would never see this older daily success — per-job query does.
  rows.push({
    job_name: 'ledger_shadow_reconcile',
    started_at: '2026-08-27T00:45:00.000Z',
    finished_at: '2026-08-27T00:45:05.000Z',
  })
  const capped = pickLatestSuccessAtByJob(rows.slice(0, 80), jobs)
  assert.equal(capped.get('ledger_shadow_reconcile'), null)

  const full = pickLatestSuccessAtByJob(rows, jobs)
  assert.equal(full.get('ledger_shadow_reconcile'), '2026-08-27T00:45:05.000Z')
})
