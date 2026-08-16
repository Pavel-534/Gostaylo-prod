/**
 * Stage 201.71 — STALE_CRON crypto enum + map cluster snap-back + hide area-search chrome.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-71-stale-cron-map-ux.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.71 — STALE_CRON + catalog map UX', () => {
  it('crypto reconcile does not query bogus CONFIRMED payment_status', () => {
    const src = read('lib/payment/reconcile-paid-intents-without-escrow.js')
    assert.match(src, /\.eq\('status',\s*'COMPLETED'\)/)
    assert.doesNotMatch(src, /\.in\('status',\s*\[[^\]]*CONFIRMED/)
  })

  it('InitialListingBoundsFit fits only once per reset cycle', () => {
    const src = read('components/listing/InteractiveSearchMap.jsx')
    assert.match(src, /if \(didFitListingsRef\.current\) return/)
    assert.match(src, /enableAreaSearchControls = false/)
    assert.match(src, /if \(!enableAreaSearchControls\) return null/)
  })

  it('stale cron TG is rate-limited per job', () => {
    const src = read('lib/ops/stale-cron-monitor.js')
    assert.match(src, /shouldSendStaleCronTelegram/)
    assert.match(src, /staleTgLastSentAt/)
  })
})
