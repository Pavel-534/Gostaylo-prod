/**
 * Stage 201.66 — listing → PENDING notifies admin TG from server (not partner→admin API).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-66-listing-moderation-telegram.test.js
 */

const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

describe('Stage 201.66 — listing moderation Telegram', () => {
  it('SSOT helper sends NEW_PARTNERS topic on new PENDING', async () => {
    const src = read('lib/partner/notify-listing-submitted-for-moderation.js')
    assert.match(src, /sendToAdminTopic\('NEW_PARTNERS'/)
    assert.match(src, /not_new_pending/)
    const { notifyListingSubmittedForModeration } = await import(
      '../lib/partner/notify-listing-submitted-for-moderation.js'
    )
    const skip = await notifyListingSubmittedForModeration({
      listing: { id: 'lst-x' },
      previousStatus: 'PENDING',
      nextStatus: 'PENDING',
    })
    assert.equal(skip.skipped, true)
  })

  it('partner listing PATCH hooks server notify; list page does not call admin telegram', () => {
    const route = read('app/api/v2/partner/listings/[id]/route.js')
    assert.match(route, /notifyListingSubmittedForModeration/)
    const page = read('app/(partner)/partner/listings/page.js')
    assert.doesNotMatch(page, /send_moderation_notification/)
    assert.doesNotMatch(page, /\/api\/v2\/admin\/telegram/)
  })

  it('admin moderation approve/reject uses sendToAdminTopic SSOT', () => {
    const mod = read('app/api/admin/moderation/route.js')
    assert.match(mod, /sendToAdminTopic\('NEW_PARTNERS'/)
    assert.doesNotMatch(mod, /LISTINGS_THREAD_ID/)
    assert.doesNotMatch(mod, /-1003832026983/)
  })
})
