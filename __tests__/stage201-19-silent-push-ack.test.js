/**
 * Stage 201.19 — Chromium/Yandex "site updated in the background" guard.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/stage201-19-silent-push-ack.test.js
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

const root = process.cwd()

function loadPolicy() {
  const code = fs.readFileSync(path.join(root, 'public/push-visibility-policy.js'), 'utf8')
  const sandbox = { self: {}, URL }
  vm.createContext(sandbox)
  vm.runInContext(code, sandbox)
  return sandbox.self.GostayloPushPolicy
}

describe('Stage 201.19 — silent push ack (no Chromium default toast)', () => {
  it('suppresses NEW_MESSAGE only for focused+visible same-origin tab', () => {
    const policy = loadPolicy()
    const origin = 'https://airento.ru'
    assert.equal(
      policy.shouldSuppressSystemNotificationForNewMessage(
        [{ url: `${origin}/messages/c1`, visibilityState: 'visible', focused: true }],
        origin,
      ),
      true,
    )
    assert.equal(
      policy.shouldSuppressSystemNotificationForNewMessage(
        [{ url: `${origin}/messages/c1`, visibilityState: 'visible', focused: false }],
        origin,
      ),
      false,
    )
    assert.equal(
      policy.shouldSuppressSystemNotificationForNewMessage(
        [{ url: `${origin}/messages/c1`, visibilityState: 'hidden', focused: true }],
        origin,
      ),
      false,
    )
  })

  it('acknowledgePushWithoutUserBanner shows silent tag then closes it', async () => {
    const policy = loadPolicy()
    const closed = []
    const registration = {
      showNotification: async (title, opts) => {
        assert.equal(opts.silent, true)
        assert.equal(opts.tag, policy.PUSH_ACK_TAG)
        assert.equal(opts.renotify, false)
        return undefined
      },
      getNotifications: async ({ tag }) => {
        assert.equal(tag, policy.PUSH_ACK_TAG)
        return [{ close: () => closed.push(tag) }]
      },
    }
    await policy.acknowledgePushWithoutUserBanner(registration)
    assert.deepEqual(closed, [policy.PUSH_ACK_TAG])
  })

  it('FCM SW acks BADGE_UPDATE and premium-quiet instead of bare return', () => {
    const src = fs.readFileSync(path.join(root, 'public/firebase-messaging-sw.js'), 'utf8')
    assert.match(src, /ackSilentPush/)
    assert.match(src, /BADGE_UPDATE[\s\S]*ackSilentPush/)
    assert.match(src, /suppressPremiumQuiet[\s\S]*ackSilentPush/)
    assert.doesNotMatch(src, /if \(suppressPremiumQuiet\) return/)
  })
})
