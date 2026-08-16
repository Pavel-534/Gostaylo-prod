/**
 * Stage 201.56 — partner cabinet entry: no poisoned prefetch; refresh JWT then hard-nav.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-56-partner-cabinet-entry.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.56 — partner cabinet entry', () => {
  it('user menu does not prefetch /partner (middleware redirect poison)', () => {
    const nav = read('lib/navigation/optimistic-nav-href.js')
    assert.match(nav, /USER_MENU_PREFETCH_PATHS/)
    assert.doesNotMatch(nav, /USER_MENU_PREFETCH_PATHS[\s\S]*?\/partner\/dashboard/)
  })

  it('user menu refreshes session then hard-navigates to partner dashboard', () => {
    const menu = read('components/app-header/UserMenuDropdown.jsx')
    assert.match(menu, /navigatePartnerCabinet/)
    assert.match(menu, /refreshUserFromServer/)
    assert.match(menu, /location\.assign\(['\"]\/partner\/dashboard['\"]\)/)
    assert.doesNotMatch(
      menu,
      /onSelect=\{\(\)\s*=>\s*navigate\(['\"]\/partner\/dashboard['\"]\)\}/,
    )
  })

  it('middleware normalizes JWT role to uppercase before zone check', () => {
    const mw = read('middleware.ts')
    assert.match(mw, /String\(decoded\.role[^)]*\)\.toUpperCase\(\)/)
  })

  it('partner dashboard nav refreshes then hard-navigates; prefeches only inside /partner', () => {
    const hook = read('hooks/use-partner-dashboard-nav.js')
    assert.match(hook, /refreshUserFromServer/)
    assert.match(hook, /location\.assign\(['\"]\/partner\/dashboard['\"]\)/)
    assert.match(hook, /pathname\?\.startsWith\(['\"]\/partner['\"]\)/)
  })
})
