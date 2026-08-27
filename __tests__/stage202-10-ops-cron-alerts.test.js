/**
 * Stage 202.10 — stop false GATEWAY_LEDGER_DRIFT + Vercel GET no-op crons that caused STALE_CRON spam.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveGatewayDriftToleranceThb } from '../lib/services/finances/gateway-reconciliation.js'

const root = join(process.cwd())

test('resolveGatewayDriftToleranceThb: empty opts uses 0.01 (not NaN)', () => {
  const t = resolveGatewayDriftToleranceThb({})
  assert.equal(t, 0.01)
  assert.ok(Number.isFinite(t))
  assert.equal(Math.abs(0) <= t, true)
})

test('resolveGatewayDriftToleranceThb: explicit 0 is valid', () => {
  assert.equal(resolveGatewayDriftToleranceThb({ driftToleranceThb: 0 }), 0)
})

test('resolveGatewayDriftToleranceThb: invalid falls back', () => {
  assert.equal(resolveGatewayDriftToleranceThb({ driftToleranceThb: 'x' }), 0.01)
  assert.equal(resolveGatewayDriftToleranceThb({ driftToleranceThb: NaN }), 0.01)
})

test('gateway-reconciliation uses resolveGatewayDriftToleranceThb (no Number ?? NaN)', () => {
  const src = readFileSync(join(root, 'lib/services/finances/gateway-reconciliation.js'), 'utf8')
  assert.match(src, /resolveGatewayDriftToleranceThb/)
  assert.doesNotMatch(src, /Number\(opts\.driftToleranceThb\)\s*\?\?/)
})

test('ledger-shadow-reconcile GET runs the same handler as POST', () => {
  const src = readFileSync(join(root, 'app/api/cron/ledger-shadow-reconcile/route.js'), 'utf8')
  assert.match(src, /runLedgerShadowCron/)
  assert.match(src, /export async function GET/)
  assert.match(src, /return runLedgerShadowCron\(request\)/)
  assert.doesNotMatch(src, /POST to run/)
})

test('financial-health-monitor GET runs the same scan as POST', () => {
  const src = readFileSync(join(root, 'app/api/cron/financial-health-monitor/route.js'), 'utf8')
  assert.match(src, /runFinancialHealthCron/)
  assert.match(src, /export async function GET/)
  assert.match(src, /return runFinancialHealthCron\(request\)/)
  assert.doesNotMatch(src, /Scans PENDING_FISCAL/)
})
