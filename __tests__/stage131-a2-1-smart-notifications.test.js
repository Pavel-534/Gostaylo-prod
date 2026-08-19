/**
 * Stage 131.A2.1 — smart notifications (gate removal, absolute URL, cancel, L2/L3 digest).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a2-1-smart-notifications.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { buildReferralFriendCancelledCopy } = require('../lib/services/notifications/referral-friend-notify-copy.js')

function read(relPath) {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf8')
}

describe('Stage 131.A2.1 smart notifications', () => {
  it('email gate removed for friend handlers and Promise.allSettled is used', () => {
    const src = read('lib/services/notifications/referral-events.js')
    assert.doesNotMatch(src, /handleReferralFriendBooked[\s\S]*if \(!loaded\?\.profile\?\.email\) return/)
    assert.doesNotMatch(src, /handleReferralFriendCompleted[\s\S]*if \(!loaded\?\.profile\?\.email\) return/)
    assert.match(src, /handleReferralFriendBooked[\s\S]*Promise\.allSettled\(tasks\)/)
    assert.match(src, /handleReferralFriendCompleted[\s\S]*Promise\.allSettled\(tasks\)/)
  })

  it('telegram links are absolute URLs', () => {
    const src = read('lib/services/notifications/referral-events.js')
    assert.match(src, /buildPublicUrl\('\/profile\/referral'\)/)
    assert.match(src, /buildPublicUrl\('\/profile\/wallet'\)/)
    assert.doesNotMatch(src, /href="\/profile\//)
  })

  it('PAID friend notification is disabled in escrow and registry', () => {
    const escrow = read('lib/services/escrow/move-to-escrow-side-effects.js')
    const registry = read('lib/services/notifications/notification-registry.js')
    assert.doesNotMatch(escrow, /maybeNotifyReferralFriendPaid/)
    assert.doesNotMatch(registry, /REFERRAL_FRIEND_PAID/)
  })

  it('CANCELLED event exists with multilingual copy', () => {
    const registry = read('lib/services/notifications/notification-registry.js')
    const triggers = read('lib/services/marketing/referral-friend-notify-triggers.js')
    const lifecycle = read('lib/services/marketing/referral-lifecycle-hook.js')
    assert.match(registry, /REFERRAL_FRIEND_CANCELLED/)
    assert.match(triggers, /maybeNotifyReferralFriendCancelled/)
    assert.match(lifecycle, /BOOKING_STATUSES_NOTIFY_FRIEND_CANCELLED/)
    for (const lang of ['ru', 'en', 'zh', 'th']) {
      const c = buildReferralFriendCancelledCopy({
        friendName: 'Alex',
        listingTitle: 'Sea View Villa',
        lang,
      })
      assert.match(c.headline, /Alex/)
      assert.match(c.headline, /Sea View Villa|Villa/)
    }
  })

  it('L2/L3 weekly digest skips zero and targets depth 2+3', () => {
    const svc = read('lib/services/marketing/referral-team-week-digest.service.js')
    const route = read('app/api/cron/referral-team-weekly-digest/route.js')
    assert.match(svc, /\.in\('ledger_depth', \[2, 3\]\)/)
    assert.match(svc, /if \(totalThb <= 0\)/)
    assert.match(route, /0 18 \* \* 0/)
  })

  it('digest channel priority: telegram then push then email', () => {
    const src = read('lib/services/notifications/referral-events.js')
    assert.match(src, /if \(profile\.telegram_id\) \{[\s\S]*return/)
    assert.match(src, /const pushResult = await PushService\.sendToUser/)
    assert.match(src, /if \(pushResult\?\.success\) return/)
    assert.match(src, /if \(profile\.email\) \{[\s\S]*sendEmail/)
  })
})

