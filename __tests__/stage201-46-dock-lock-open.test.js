/**
 * Stage 201.46 — dock lock follows overlay `open`, not Content mount.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-46-dock-lock-open.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.46 — dock lock only while overlay open', () => {
  it('Sheet locks bottom dock only when Root open', () => {
    const src = read('components/ui/sheet.jsx')
    assert.match(src, /OverlayOpenProvider/)
    assert.match(src, /useOverlayOpen/)
    assert.match(src, /useMobileDockLock\(side === 'bottom' && sheetOpen\)/)
    assert.doesNotMatch(src, /useMobileDockLock\(side === 'bottom'\)\s*$/m)
  })

  it('Dialog locks dock only when open on phone', () => {
    const src = read('components/ui/dialog.jsx')
    assert.match(src, /OverlayOpenProvider/)
    assert.match(src, /useMobileDockLock\(dialogOpen && isPhone\)/)
    assert.doesNotMatch(src, /useMobileDockLock\(lockDock\)/)
  })

  it('isMobileDockLocked ignores stale dataset', () => {
    const {
      acquireMobileDockLock,
      isMobileDockLocked,
      __resetMobileDockLockForTests,
    } = require('../lib/layout/mobile-dock-lock.js')

    __resetMobileDockLockForTests()
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.mobileDockLock = '9'
    }
    assert.equal(isMobileDockLocked(), false)
    const release = acquireMobileDockLock()
    assert.equal(isMobileDockLocked(), true)
    release()
    assert.equal(isMobileDockLocked(), false)
    __resetMobileDockLockForTests()
  })

  it('overlay open context module exists', () => {
    assert.match(read('lib/layout/overlay-open-context.jsx'), /useMirroredOpenState/)
  })
})
