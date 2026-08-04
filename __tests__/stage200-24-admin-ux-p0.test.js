/**
 * Stage 200.24 — Admin UX P0/P1 (sidebar blur + moderation dialog).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-24-admin-ux-p0.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.24 — admin mobile sidebar blur fix', () => {
  it('places backdrop inside WORKSPACE_FRAME like partner', () => {
    const admin = read('app/admin/layout.js')
    const partner = read('app/(partner)/partner/layout.js')
    assert.match(admin, /WORKSPACE_FRAME_CLASS/)
    assert.match(admin, /top-\[var\(--app-header-height/)
    assert.match(admin, /max-lg:backdrop-blur-none/)
    assert.match(admin, /admin-workspace-sidebar/)
    // Backdrop must not sit before AppHeader as a root sibling overlay over the frame
    const frameIdx = admin.indexOf('WORKSPACE_FRAME_CLASS')
    const backdropInside = admin.indexOf('bg-slate-900/60 backdrop-blur-sm', frameIdx)
    assert.ok(backdropInside > frameIdx, 'backdrop should be after frame open')
    assert.match(partner, /max-lg:backdrop-blur-none/)
  })
})

describe('Stage 200.24 — moderation dialog + RU CTAs', () => {
  it('uses wide dialog, scroll body, sticky footer, RU labels', () => {
    const src = read('app/admin/moderation/page.js')
    assert.match(src, /sm:max-w-4xl/)
    assert.match(src, /min-h-0 flex-1 overflow-y-auto/)
    assert.match(src, /shrink-0.*border-t/)
    assert.match(src, /Одобрить/)
    assert.match(src, /Отклонить/)
    assert.match(src, /На проверке/)
    assert.match(src, /Сохранить правки/)
    assert.match(src, /Править объявление/)
    assert.doesNotMatch(src, />\s*Approve\s*</)
    assert.doesNotMatch(src, />\s*Reject\s*</)
    assert.doesNotMatch(src, />\s*PENDING\s*</)
  })
})
