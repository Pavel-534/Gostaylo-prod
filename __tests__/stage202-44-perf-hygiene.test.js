/**
 * Stage 202.44 — PostHog hygiene + map-pins cache + cron empty-path cuts.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-44-perf-hygiene.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.44 — perf hygiene', () => {
  it('PostHog init disables autocapture; listing_view deduped by id', () => {
    const analytics = read('lib/analytics/product-analytics.js')
    assert.match(analytics, /autocapture:\s*false/)
    assert.match(analytics, /disable_session_recording:\s*true/)
    const pdp = read('hooks/useListingViewData.js')
    assert.match(pdp, /trackedListingViewIdRef/)
    const init = read('components/analytics/ProductAnalyticsInit.jsx')
    assert.match(init, /lastPageViewKeyRef/)
  })

  it('map-pins overlaps commission fetch and lengthens anon browse CDN TTL', () => {
    const pins = read('lib/api/run-map-pins-get.js')
    assert.match(pins, /commissionPromise/)
    assert.match(pins, /hasDateFilter/)
    const edge = read('lib/api/public-edge-cache-control.js')
    assert.match(edge, /sMaxAge: 45/)
    assert.match(edge, /sMaxAge: 10/)
    const spatial = read('lib/ops/spatial-query-cache.js')
    assert.match(spatial, /25 \* 1000/)
  })

  it('cron empty paths: outbox probe, flash-sale window SQL, cleanup parallel janitor', () => {
    const outbox = read('lib/services/notifications/process-notification-outbox.js')
    assert.match(outbox, /empty:\s*true/)
    assert.match(outbox, /probe_error|probeRows/)
    const flash = read('app/api/cron/flash-sale-reminder/route.js')
    assert.match(flash, /\.lte\('valid_until'/)
    assert.match(flash, /\.gt\('valid_until'/)
    const cleanup = read('app/api/cron/cleanup-drafts/route.js')
    assert.match(cleanup, /Promise\.allSettled/)
  })
})
