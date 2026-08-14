/**
 * Stage 201.15 — marketing i18n + Suspense / chunk recovery (footer stays soft Link).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-15-marketing-footer-nav.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.15 — marketing nav resilience', () => {
  it('home footer keeps soft Next Link for marketing/legal (no hard <a> document reload)', () => {
    const src = read('components/PlatformHomeContent.jsx')
    assert.match(src, /<Link href="\/about\/"/)
    assert.match(src, /<Link href="\/legal\/public-offer\/"/)
    assert.match(src, /<Link href="\/terms\/"/)
    assert.match(src, /<Link href="\/help\/"/)
    assert.doesNotMatch(src, /Stage 201\.15 — hard <a>/)
  })

  it('marketing layout registers i18n + MarketingAppShell boots marketing preset', () => {
    const layout = read('app/(marketing)/layout.js')
    assert.match(layout, /register-storefront-common-i18n/)
    assert.match(layout, /register-errors-i18n/)
    const shell = read('components/layout/MarketingAppShell.jsx')
    assert.match(shell, /I18nSliceBootstrap preset="marketing"/)
    const presets = read('lib/translations/i18n-client-slice-presets.js')
    assert.match(presets, /marketing:\s*\[/)
  })

  it('AppHeader Suspense-wraps ScrollProgressBar; error retry hard-reloads chunk failures', () => {
    const header = read('components/app-header/AppHeader.jsx')
    assert.match(header, /Suspense/)
    assert.match(header, /ScrollProgressBar/)
    const err = read('components/product/AppErrorBoundaryView.jsx')
    assert.match(err, /isClientNavFailure/)
    assert.match(err, /location\.reload/)
    const helper = require('../lib/navigation/is-client-nav-failure.js')
    assert.equal(helper.isClientNavFailure({ name: 'ChunkLoadError', message: 'Loading chunk 1 failed' }), true)
    assert.equal(helper.isClientNavFailure({ message: 'boom' }), false)
  })

  it('marketing segment has local error.js', () => {
    assert.match(read('app/(marketing)/error.js'), /AppErrorBoundaryView/)
  })
})
