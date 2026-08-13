/**
 * Stage 200.132 — renter profile auth hang / false logout.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage200-132-renter-profile-auth-loop.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 200.132 — renter profile auth loop + session harden', () => {
  it('renter profile applies auth-change detail and does not refresh on auth-change', () => {
    const src = read('hooks/renter/use-renter-profile-page.js')
    assert.match(src, /onAuthChange/)
    assert.match(src, /applyUser\(e\?\.detail/)
    assert.doesNotMatch(src, /addEventListener\('auth-change',\s*sync\)/)
    assert.doesNotMatch(src, /addEventListener\('gostaylo-refresh-session'/)
    assert.match(src, /softRefreshDoneForUserId/)
    assert.match(src, /authUser/)
  })

  it('refreshUserFromServer keeps session on transient getCurrentUser failure', () => {
    const src = read('contexts/auth/auth-session-sync.js')
    assert.match(src, /transient failure/)
    assert.match(src, /return undefined/)
    assert.match(src, /keeping cached user/)
  })

  it('getCurrentUser throws on non-auth HTTP errors; null only for 401/403', () => {
    const src = read('lib/auth.js')
    assert.match(src, /response\.status === 401 \|\| response\.status === 403/)
    assert.match(src, /auth\/me failed/)
    assert.doesNotMatch(
      src,
      /getCurrentUser\(\) \{[\s\S]*catch \(error\) \{[\s\S]*return null/,
    )
  })
})
