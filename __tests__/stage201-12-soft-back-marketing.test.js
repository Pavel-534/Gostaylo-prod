/**
 * Stage 201.12 — soft-back SSOT P0 for MarketingAppShell (iOS nested marketing).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-12-soft-back-marketing.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.12 — soft-back SSOT P0 marketing', () => {
  it('useSoftBack remains the behavior SSOT', () => {
    const hook = read('hooks/use-soft-back.js')
    assert.match(hook, /export function useSoftBack/)
    assert.match(hook, /router\.back\(/)
    assert.match(hook, /router\.push\(target\)/)
  })

  it('AppHeader exposes showSoftBack + softBackFallback via useSoftBack', () => {
    const src = read('components/app-header/AppHeader.jsx')
    assert.match(src, /showSoftBack\s*=\s*false/)
    assert.match(src, /softBackFallback\s*=\s*['"]\/['"]/)
    assert.match(src, /useSoftBack\(softBackFallback\)/)
    assert.match(src, /data-testid="app-header-soft-back"/)
    assert.match(src, /appHeader_softBackAria/)
    assert.match(src, /min-h-\[44px\]/)
  })

  it('MarketingAppShell defaults soft-back on; escrow fallback is /help', () => {
    const src = read('components/layout/MarketingAppShell.jsx')
    assert.match(src, /showSoftBack\s*=\s*true/)
    assert.match(src, /resolveMarketingSoftBackFallback/)
    assert.match(src, /<AppHeader showSoftBack=\{showSoftBack\} softBackFallback=\{fallback\} \/>/)
    const routes = read('lib/navigation/soft-back-routes.js')
    assert.match(routes, /\/help\/escrow-protection/)
    assert.match(routes, /return '\/help'/)
  })

  it('escrow-protection page has no local ArrowLeft /messages back', () => {
    const page = read('app/(marketing)/help/escrow-protection/page.js')
    assert.doesNotMatch(page, /from ['"]lucide-react['"].*ArrowLeft|ArrowLeft.*from ['"]lucide-react['"]/)
    assert.doesNotMatch(page, /href=["']\/messages["']/)
    assert.doesNotMatch(page, /escrowProtection_backToMessages/)
  })

  it('marketing layout uses MarketingAppShell (covers P0 routes)', () => {
    const layout = read('app/(marketing)/layout.js')
    assert.match(layout, /MarketingAppShell/)
  })

  it('i18n soft-back aria present for ru/en/zh/th', () => {
    const ui = read('lib/translations/common-ui.js')
    const matches = ui.match(/appHeader_softBackAria/g) || []
    assert.equal(matches.length, 4)
  })
})
