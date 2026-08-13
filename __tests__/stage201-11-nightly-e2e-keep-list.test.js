/**
 * Stage 201.11 — nightly Playwright keep-list (no DB-spam fixtures).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-11-nightly-e2e-keep-list.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.11 — nightly E2E keep-list', () => {
  it('CI runs npm run test:e2e:nightly, not full playwright suite', () => {
    const yml = read('.github/workflows/playwright.yml')
    assert.match(yml, /npm run test:e2e:nightly/)
    assert.match(yml, /npm run cleanup:test-data:execute/)
    assert.equal(/run: npx playwright test\s*$/m.test(yml), false)

    const pkg = JSON.parse(read('package.json'))
    const nightly = String(pkg.scripts['test:e2e:nightly'] || '')
    for (const keep of [
      'stage12-escrow-regression',
      'guest-inquiry-golden-path',
      'chat-invoice-payment-golden-path',
      'checkout-mock-smoke',
      'accountant-bot',
      'wizard-geo-location',
      'partner-calendar-flow',
      'rbac-partner',
      'security-bot',
    ]) {
      assert.match(nightly, new RegExp(`--project=${keep}`))
    }
    for (const drop of [
      'stage72-referral-cashflow',
      'referral-dashboard-visual',
      'chat-stress',
      'seo-spy-bot',
      'speed-bot',
      'polyglot-bot',
      'cro-funnel-smoke',
      'discovery-analytics',
    ]) {
      assert.equal(nightly.includes(drop), false, drop)
    }
  })
})
