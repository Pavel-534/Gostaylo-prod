/**
 * Stage 202.42 — safe resilience slice (commission cache + read/TG retry).
 * Run:
 *   node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-42-supabase-tg-resilience.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('Stage 202.42 — supabase/TG resilience (safe slice)', () => {
  it('isTransientOpsError covers Bad Gateway and 525', () => {
    const { isTransientOpsError } = require('../lib/ops/is-transient-ops-error.js')
    assert.equal(isTransientOpsError('Bad Gateway'), true)
    assert.equal(isTransientOpsError('SSL handshake failed Error code 525'), true)
    assert.equal(isTransientOpsError('PRICE_TAMPER'), false)
  })

  it('withTransientRetry retries then succeeds', async () => {
    const { withTransientRetry } = require('../lib/ops/with-transient-retry.js')
    let n = 0
    const out = await withTransientRetry(
      async () => {
        n += 1
        if (n === 1) throw new Error('Gateway Timeout')
        return 'ok'
      },
      { attempts: 2, baseDelayMs: 10, label: 'test' },
    )
    assert.equal(out, 'ok')
    assert.equal(n, 2)
  })

  it('getCommissionRate uses unstable_cache + partner read retry', () => {
    const src = read('lib/commission/get-commission-rate-server.js')
    assert.match(src, /unstable_cache/)
    assert.match(src, /commission-rate-system-v1/)
    assert.match(src, /withTransientSupabaseRead/)
    assert.match(src, /revalidate:\s*COMMISSION_CACHE_REVALIDATE_SEC|revalidate:\s*45/)
  })

  it('sendTelegram retries outbound Bot API once (not webhook)', () => {
    const src = read('lib/services/telegram/api.js')
    assert.match(src, /withTransientRetry/)
    assert.match(src, /telegram-sendMessage/)
    assert.match(src, /attempts:\s*2/)
  })

  it('system_settings reads retry; upsert path unchanged (no retry wrapper)', () => {
    const src = read('lib/admin/system-settings-store.js')
    assert.match(src, /withTransientSupabaseRead/)
    assert.match(src, /system-settings-read/)
    const upsertBlock = src.slice(src.indexOf('export async function upsertSystemSetting'))
    assert.doesNotMatch(upsertBlock.slice(0, 400), /withTransient/)
  })
})
