/**
 * Stage M1.1 — web push client state helpers.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/push-m11-client-state.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  PUSH_ENABLE_EVENT,
  PUSH_FCM_TOKEN_KEY,
  PUSH_REGISTERED_UID_KEY,
  clearSessionPushSync,
  clearWebPushClientStorage,
  getSessionPushSync,
  setSessionPushSync,
  shouldSyncPushOnResume,
  resetPushResumeThrottleForTests,
  PUSH_RESUME_THROTTLE_MS,
} from '@/lib/push/web-push-client-state.js'

describe('M1.1 web-push-client-state', () => {
  const store = new Map()

  beforeEach(() => {
    store.clear()
    clearSessionPushSync()
    resetPushResumeThrottleForTests()
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    }
    globalThis.sessionStorage = {
      getItem: (k) => (store.has(`s:${k}`) ? store.get(`s:${k}`) : null),
      setItem: (k, v) => store.set(`s:${k}`, String(v)),
      removeItem: (k) => store.delete(`s:${k}`),
    }
    globalThis.window = {}
  })

  afterEach(() => {
    delete globalThis.localStorage
    delete globalThis.sessionStorage
    delete globalThis.window
    clearSessionPushSync()
    resetPushResumeThrottleForTests()
  })

  it('exports enable event and storage keys', () => {
    assert.equal(PUSH_ENABLE_EVENT, 'gostaylo:push-enable')
    assert.equal(PUSH_FCM_TOKEN_KEY, 'gostaylo_fcm_token')
    assert.equal(PUSH_REGISTERED_UID_KEY, 'gostaylo_push_registered_uid')
  })

  it('tracks session sync for idempotent register', () => {
    setSessionPushSync('u1', 'tok-a')
    assert.deepEqual(getSessionPushSync(), { uid: 'u1', token: 'tok-a' })
    clearSessionPushSync()
    assert.deepEqual(getSessionPushSync(), { uid: null, token: null })
  })

  it('clearWebPushClientStorage removes fcm keys + session sync', () => {
    store.set(PUSH_FCM_TOKEN_KEY, 'tok')
    store.set(`s:${PUSH_REGISTERED_UID_KEY}`, 'u1')
    setSessionPushSync('u1', 'tok')
    clearWebPushClientStorage()
    assert.equal(store.has(PUSH_FCM_TOKEN_KEY), false)
    assert.equal(store.has(`s:${PUSH_REGISTERED_UID_KEY}`), false)
    assert.deepEqual(getSessionPushSync(), { uid: null, token: null })
  })

  it('shouldSyncPushOnResume only when granted and not yet session-synced', () => {
    assert.equal(shouldSyncPushOnResume('u1', { permission: 'denied', now: 1000 }), false)
    assert.equal(shouldSyncPushOnResume('u1', { permission: 'default', now: 1000 }), false)
    assert.equal(shouldSyncPushOnResume('u1', { permission: 'granted', now: 1000 }), true)
    // throttle
    assert.equal(shouldSyncPushOnResume('u1', { permission: 'granted', now: 1000 + 100 }), false)
    assert.equal(
      shouldSyncPushOnResume('u1', {
        permission: 'granted',
        now: 1000 + PUSH_RESUME_THROTTLE_MS,
      }),
      true,
    )
    setSessionPushSync('u1', 'tok')
    resetPushResumeThrottleForTests()
    assert.equal(shouldSyncPushOnResume('u1', { permission: 'granted', now: 50_000 }), false)
  })
})
