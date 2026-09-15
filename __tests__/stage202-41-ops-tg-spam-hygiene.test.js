/**
 * Stage 202.41 — ops TG spam hygiene.
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-41-ops-tg-spam-hygiene.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('Stage 202.41 — ops TG spam hygiene', () => {
  it('isTransientOpsError catches Gateway Timeout / AbortError', () => {
    const { isTransientOpsError } = require('../lib/ops/is-transient-ops-error.js')
    assert.equal(isTransientOpsError('Gateway Timeout'), true)
    assert.equal(isTransientOpsError('The operation was aborted due to timeout'), true)
    assert.equal(isTransientOpsError('PRICE_TAMPER detected'), false)
  })

  it('notifySystemAlert skips transient infra by default', () => {
    const src = read('lib/services/system-alert-notify.js')
    assert.match(src, /isTransientOpsError/)
    assert.match(src, /skipped transient infra noise/)
    assert.match(src, /TRANSIENT_INFRA/)
  })

  it('cleanup-drafts GET runs POST + Array.isArray guard + maxDuration', () => {
    const src = read('app/api/cron/cleanup-drafts/route.js')
    assert.match(src, /export const maxDuration = 60/)
    assert.match(src, /export async function GET\(request\) \{\s*return POST\(request\)/)
    assert.match(src, /Array\.isArray\(allInactiveRaw\)/)
    assert.doesNotMatch(src, /GET dry-run/)
  })

  it('reconcile-yookassa skips empty [] alert noise', () => {
    const src = read('app/api/cron/reconcile-yookassa-pending/route.js')
    assert.match(src, /detail !== '\[\]'/)
  })
})
