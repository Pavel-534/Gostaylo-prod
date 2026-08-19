/**
 * Stage 131.A2 — friend lifecycle notifications (booked / paid / completed).
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage131-a2-notifications.test.js
 */
const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const {
  buildReferralFriendBookedCopy,
  buildReferralFriendPaidCopy,
  buildReferralFriendCompletedCopy,
  planReferralFriendNotifyChannels,
} = require('../lib/services/notifications/referral-friend-notify-copy.js')

const root = process.cwd()
function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

const AMOUNT = '1,500 THB'
const FRIEND = 'Alex'
const LISTING = 'Sea View Villa'

describe('Stage 131.A2 — friend notifications', () => {
  it('REFERRAL_FRIEND_BOOKED — 3 channels with telegram_id, 2 without', () => {
    assert.deepEqual(
      planReferralFriendNotifyChannels({ email: 'amb@test.invalid', telegram_id: '999' }),
      ['email', 'push', 'telegram'],
    )
    assert.deepEqual(planReferralFriendNotifyChannels({ email: 'amb@test.invalid' }), [
      'email',
      'push',
    ])
  })

  it('REFERRAL_FRIEND_PAID — same channel plan', () => {
    assert.deepEqual(planReferralFriendNotifyChannels({ email: 'x@y.z', telegram_id: '1' }), [
      'email',
      'push',
      'telegram',
    ])
    assert.deepEqual(planReferralFriendNotifyChannels({ email: 'x@y.z' }), ['email', 'push'])
  })

  it('REFERRAL_FRIEND_COMPLETED — same channel plan', () => {
    assert.deepEqual(planReferralFriendNotifyChannels({ email: 'x@y.z', telegram_id: '42' }), [
      'email',
      'push',
      'telegram',
    ])
    assert.deepEqual(planReferralFriendNotifyChannels({ email: 'x@y.z', telegram_id: null }), [
      'email',
      'push',
    ])
  })

  it('consent not required — registry async handlers, not intentionally dead', () => {
    const registry = read('lib/services/notifications/notification-registry.js')
    const handlers = {
      REFERRAL_FRIEND_BOOKED: 'handleReferralFriendBooked',
      REFERRAL_FRIEND_PAID: 'handleReferralFriendPaid',
      REFERRAL_FRIEND_COMPLETED: 'handleReferralFriendCompleted',
    }
    for (const [key, handler] of Object.entries(handlers)) {
      assert.match(registry, new RegExp(`${key}:\\s*\\{ handler: ReferralEvents\\.${handler}`))
      assert.match(registry, new RegExp(`${key}:[\\s\\S]*?isAsync: true`))
    }
    const notifySvc = read('lib/services/marketing/referral-notification.service.js')
    assert.doesNotMatch(notifySvc, /requiresConsent|mlm_consent/)
  })

  it('amounts in BOOKED copy for RU / EN / ZH / TH', () => {
    for (const lang of ['ru', 'en', 'zh', 'th']) {
      const c = buildReferralFriendBookedCopy({
        friendName: FRIEND,
        listingTitle: LISTING,
        amountLabel: AMOUNT,
        lang,
      })
      assert.match(c.headline, /1,500 THB/, lang)
      assert.match(c.headline, /Alex/, lang)
      assert.match(c.headline, /Sea View Villa|Villa/, lang)
    }
  })

  it('amounts in PAID copy for RU / EN / ZH / TH', () => {
    for (const lang of ['ru', 'en', 'zh', 'th']) {
      const c = buildReferralFriendPaidCopy({ friendName: FRIEND, amountLabel: AMOUNT, lang })
      assert.match(c.headline, /1,500 THB/, lang)
      assert.match(c.headline, /Alex/, lang)
    }
  })

  it('amounts in COMPLETED copy for RU / EN / ZH / TH', () => {
    for (const lang of ['ru', 'en', 'zh', 'th']) {
      const c = buildReferralFriendCompletedCopy({
        friendName: FRIEND,
        listingTitle: LISTING,
        amountLabel: AMOUNT,
        lang,
      })
      assert.match(c.headline, /1,500 THB/, lang)
      assert.match(c.headline, /Alex/, lang)
    }
  })

  it('outbox enqueue failure → sync fallback in NotificationService.dispatch', () => {
    const src = read('lib/services/notification.service.js')
    assert.match(src, /outbox enqueue failed, sync fallback/)
    assert.match(src, /await handler\(data\)/)
  })

  it('in-app feed ALLOWED types include friend_* events', () => {
    const src = read('lib/referral/insert-referral-team-event.js')
    assert.match(src, /friend_booked/)
    assert.match(src, /friend_paid/)
    assert.match(src, /friend_completed/)
  })

  it('triggers wired: bookings, escrow paid, distribute completed', () => {
    assert.match(read('app/api/v2/bookings/route.js'), /maybeNotifyReferralFriendBooked/)
    assert.match(read('lib/services/escrow/move-to-escrow-side-effects.js'), /maybeNotifyReferralFriendPaid/)
    assert.match(read('lib/services/marketing/referral-payout.service.js'), /maybeNotifyReferralFriendCompleted/)
  })
})
