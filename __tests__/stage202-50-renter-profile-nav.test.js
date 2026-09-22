/**
 * Stage 202.50 — Profile tab logged-in → auth/login bounce (prefetch poison).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage202-50-renter-profile-nav.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isMiddlewareGuardedCabinetHref,
} from '../lib/navigation/guarded-cabinet-nav.js'
import {
  STOREFRONT_NAV_PREFETCH_PATHS,
  USER_MENU_PREFETCH_PATHS,
} from '../lib/navigation/optimistic-nav-href.js'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 202.50 — renter profile nav without prefetch poison', () => {
  it('does not prefetch middleware-guarded /renter paths from dock or avatar menu', () => {
    assert.ok(!STOREFRONT_NAV_PREFETCH_PATHS.some((p) => p.startsWith('/renter')))
    assert.ok(!USER_MENU_PREFETCH_PATHS.some((p) => p.startsWith('/renter')))
    assert.ok(!USER_MENU_PREFETCH_PATHS.some((p) => p.startsWith('/partner')))
  })

  it('classifies cabinet hrefs for hard-nav', () => {
    assert.equal(isMiddlewareGuardedCabinetHref('/renter/profile'), true)
    assert.equal(isMiddlewareGuardedCabinetHref('/renter/favorites'), true)
    assert.equal(isMiddlewareGuardedCabinetHref('/partner/dashboard'), true)
    assert.equal(isMiddlewareGuardedCabinetHref('/messages'), false)
    assert.equal(isMiddlewareGuardedCabinetHref('/listings'), false)
  })

  it('bottom nav hard-navigates profile after session refresh', () => {
    const src = read('components/mobile-bottom-nav.jsx')
    assert.match(src, /navigateMiddlewareGuardedHref/)
    assert.match(src, /isMiddlewareGuardedCabinetHref/)
    assert.match(src, /openLoginModal\?\.\(\{\s*redirect:\s*item\.href\s*\}\)/)
  })

  it('user menu uses guarded hard-nav for /renter and partner cabinet', () => {
    const menu = read('components/app-header/UserMenuDropdown.jsx')
    assert.match(menu, /navigateMiddlewareGuardedHref/)
    assert.match(menu, /isMiddlewareGuardedCabinetHref/)
    assert.match(menu, /navigatePartnerCabinet/)
  })
})
