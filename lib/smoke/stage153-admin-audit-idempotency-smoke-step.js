/**
 * Stage 153.1 — admin audit idempotency intercept smoke (no ledger / no live dispute).
 */
import { randomUUID } from 'node:crypto'
import { E2E_TEST_DATA_TAG } from '@/lib/e2e/test-data-tag'
import {
  interceptDuplicateIdempotencyKey,
  recordAdminAudit,
} from '@/lib/services/audit/admin-audit.js'

export async function runStage153AdminAuditIdempotencySmokeStep() {
  const key = `smoke-153-${randomUUID()}`
  const entityId = `smoke-entity-${randomUUID()}`

  const first = await recordAdminAudit({
    actorId: null,
    actorRole: 'ADMIN',
    action: 'smoke_idempotency_probe',
    entityType: 'smoke',
    entityId,
    reason: `${E2E_TEST_DATA_TAG} stage153 idempotency`,
    payload: { tag: E2E_TEST_DATA_TAG },
    idempotencyKey: key,
  })
  if (!first.ok) {
    return { ok: false, detail: `audit_insert_failed:${first.error || 'unknown'}` }
  }

  const dupResponse = await interceptDuplicateIdempotencyKey(key)
  if (!dupResponse) {
    return { ok: false, detail: 'expected_duplicate_intercept_response' }
  }

  const body = await dupResponse.json()
  if (body?.success !== true || body?.skipped !== true) {
    return { ok: false, detail: `unexpected_body:${JSON.stringify(body)}` }
  }
  if (body?.msg !== 'Duplicate operational request intercepted') {
    return { ok: false, detail: `unexpected_msg:${body?.msg}` }
  }

  return { ok: true, detail: `idempotency_key=${key}` }
}
