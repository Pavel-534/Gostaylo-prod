/**
 * Stage 200.126 — partner sidebar footer compact (more room for primary nav).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-126-partner-sidebar-footer-compact.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

describe('Stage 200.126 — partner sidebar footer compact', () => {
  it('RU/EN short guest + partner-terms labels (sidebar keys)', () => {
    const i18n = readFileSync(
      join(root, 'lib/translations/slices/partner-shell.js'),
      'utf8',
    )
    assert.ok(i18n.includes('partnerNav_switchToGuestMode: "Режим гостя"'))
    assert.ok(i18n.includes('partnerNav_partnerTerms: "Условия для партнёров"'))
    assert.ok(i18n.includes('partnerNav_switchToGuestMode: "Guest mode"'))
    assert.ok(i18n.includes('partnerNav_partnerTerms: "Partner terms"'))
    assert.doesNotMatch(i18n, /Режим гостя · Мои бронирования/)
    assert.doesNotMatch(i18n, /агентский договор/)
  })

  it('sidebar footer has no logout; uses short partner terms key', () => {
    const src = readFileSync(join(root, 'app/(partner)/partner/layout.js'), 'utf8')
    assert.ok(src.includes('partner-switch-to-guest'))
    assert.ok(src.includes("getUIText('partnerNav_partnerTerms'"))
    assert.doesNotMatch(src, /LogOut|handleLogout|getUIText\('logout'/)
    assert.doesNotMatch(src, /footerPartnerTerms/)
  })

  it('site footer legal string stays full (not shortened globally)', () => {
    const common = readFileSync(join(root, 'lib/translations/common-ui.js'), 'utf8')
    assert.ok(common.includes('Условия для партнёров (агентский договор)'))
  })
})
