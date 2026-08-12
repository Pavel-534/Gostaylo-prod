/**
 * Stage 200.123 — Partner mobile sidebar clears bottom dock / home indicator.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-123-partner-sidebar-dock-inset.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { WORKSPACE_SIDEBAR_CLASS } from '@/lib/layout/workspace-shell.js'

const root = process.cwd()

describe('Stage 200.123 — partner sidebar dock inset', () => {
  it('app-workspace-sidebar uses bottom dock inset (not 100dvh−header alone)', () => {
    const css = readFileSync(join(root, 'app/globals.css'), 'utf8')
    const block = css.match(/\.app-workspace-sidebar\s*\{[^}]+\}/)
    assert.ok(block, 'expected .app-workspace-sidebar rule')
    assert.ok(block[0].includes('--app-bottom-nav-height'))
    assert.ok(block[0].includes('bottom:'))
    assert.doesNotMatch(block[0], /100dvh/)
  })

  it('workspace sidebar still pairs with app-workspace-sidebar', () => {
    assert.ok(WORKSPACE_SIDEBAR_CLASS.includes('app-workspace-sidebar'))
  })

  it('partner layout keeps scrollable nav + min 44px touch rows', () => {
    const src = readFileSync(join(root, 'app/(partner)/partner/layout.js'), 'utf8')
    assert.ok(src.includes('overflow-y-auto'))
    assert.ok(src.includes('min-h-11'))
    assert.ok(src.includes('py-1.5'))
    assert.ok(src.includes('bottom-[var(--app-bottom-nav-height,0px)]'))
  })

  it('bottom dock uses short bookings label key + RU «Брони»', () => {
    const nav = readFileSync(
      join(root, 'components/partner/PartnerMobileBottomNav.jsx'),
      'utf8',
    )
    const i18n = readFileSync(
      join(root, 'lib/translations/slices/partner-shell.js'),
      'utf8',
    )
    assert.ok(nav.includes("labelKey: 'partnerNav_bookingsShort'"))
    assert.ok(i18n.includes('partnerNav_bookingsShort: "Брони"'))
    assert.ok(i18n.includes('partnerNav_bookings: "Бронирования"'))
  })
})
