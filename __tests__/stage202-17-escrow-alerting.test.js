/**
 * Stage 202.17 — escrow alerting polish (crypto 502 + ESCROW_RPC_FAILED signal).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

test('crypto webhook alerts on httpStatus >= 500 (includes 502 ESCROW_FAILED)', () => {
  const src = readFileSync(join(root, 'app/api/webhooks/crypto/confirm/route.js'), 'utf8')
  assert.match(src, /Number\(settled\.httpStatus\) >= 500/)
  assert.doesNotMatch(src, /settled\.httpStatus === 500/)
})

test('EscrowService.moveToEscrow emits ESCROW_RPC_FAILED on failures', () => {
  const src = readFileSync(join(root, 'lib/services/escrow.service.js'), 'utf8')
  assert.match(src, /recordCriticalSignal\('ESCROW_RPC_FAILED'/)
  assert.match(src, /emitEscrowRpcFailedSignal/)
  assert.match(src, /Atomic RPC failed/)
})

test('ESCROW_RPC_FAILED persisted in critical telemetry + admin panel keys', () => {
  const telemetry = readFileSync(join(root, 'lib/critical-telemetry.js'), 'utf8')
  const admin = readFileSync(join(root, 'lib/admin/critical-signal-keys.js'), 'utf8')
  assert.match(telemetry, /'ESCROW_RPC_FAILED'/)
  assert.match(admin, /'ESCROW_RPC_FAILED'/)
  assert.match(admin, /Escrow RPC moveToEscrow failed/)
})
