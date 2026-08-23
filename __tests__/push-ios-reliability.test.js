/**
 * Stage 189.38 — web push platform + hygiene helpers.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/push-ios-reliability.test.js
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  canRegisterWebPushOnThisDevice,
  getWebPushUnavailableReason,
  hasWebPushApiSupport,
  isIosWebPushTokenFromDeviceInfo,
} from '@/lib/push/web-push-platform.js'
import {
  shouldSkipHygieneByRecentActivity,
  shouldSkipSilentBadgeHygieneProbe,
} from '@/lib/push/push-token-hygiene.js'
import {
  isPushSoftPromptSnoozed,
  snoozePushSoftPrompt,
  clearPushSoftPromptSnoozeForTests,
} from '@/lib/push/push-soft-prompt-storage.js'

describe('push iOS reliability (189.38)', () => {
  it('isIosWebPushTokenFromDeviceInfo detects iPhone UA', () => {
    assert.equal(
      isIosWebPushTokenFromDeviceInfo({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        platform: 'iPhone',
      }),
      true,
    )
    assert.equal(
      isIosWebPushTokenFromDeviceInfo({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', platform: 'Linux' }),
      false,
    )
    assert.equal(isIosWebPushTokenFromDeviceInfo({ surface: 'ios_pwa' }), false)
  })

  it('shouldSkipSilentBadgeHygieneProbe skips ios_pwa surface and iOS UA', () => {
    assert.equal(shouldSkipSilentBadgeHygieneProbe({ surface: 'ios_pwa' }), true)
    assert.equal(
      shouldSkipSilentBadgeHygieneProbe({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      }),
      true,
    )
    assert.equal(
      shouldSkipSilentBadgeHygieneProbe({ userAgent: 'Mozilla/5.0 (Linux; Android 14)' }),
      false,
    )
  })

  it('shouldSkipHygieneByRecentActivity respects 48h window', () => {
    const now = Date.parse('2026-08-22T12:00:00.000Z')
    assert.equal(
      shouldSkipHygieneByRecentActivity('2026-08-21T12:00:00.000Z', 48, now),
      true,
    )
    assert.equal(
      shouldSkipHygieneByRecentActivity('2026-08-19T12:00:00.000Z', 48, now),
      false,
    )
    assert.equal(shouldSkipHygieneByRecentActivity(null, 48, now), false)
  })

  it('push soft prompt snooze', () => {
    const store = new Map()
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    }
    clearPushSoftPromptSnoozeForTests()
    assert.equal(isPushSoftPromptSnoozed(), false)
    snoozePushSoftPrompt(7)
    assert.equal(isPushSoftPromptSnoozed(), true)
    const future = Date.now() + 8 * 24 * 60 * 60 * 1000
    assert.equal(isPushSoftPromptSnoozed(future), false)
    clearPushSoftPromptSnoozeForTests()
    delete globalThis.localStorage
  })

  it('getWebPushUnavailableReason on missing APIs', () => {
    const prevWindow = globalThis.window
    const prevNav = globalThis.navigator
    delete globalThis.window
    delete globalThis.navigator
    assert.equal(hasWebPushApiSupport(), false)
    assert.equal(canRegisterWebPushOnThisDevice(), false)
    assert.equal(getWebPushUnavailableReason(), 'unsupported')
    globalThis.window = prevWindow
    globalThis.navigator = prevNav
  })
})
