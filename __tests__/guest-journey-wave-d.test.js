/**
 * Stage 196.0-D — guest next-steps day-of + access pack offline cache
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/guest-journey-wave-d.test.js
 */

const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')

describe('resolveGuestNextStepsStep day-of', () => {
  it('uses DAY_OF when access pack eligible', async () => {
    const { resolveGuestNextStepsStep } = await import('../lib/guest/resolve-guest-next-steps.js')
    const step = resolveGuestNextStepsStep({
      status: 'PAID_ESCROW',
      checkInIso: '2026-07-27',
      accessPackVisible: true,
      now: new Date('2026-07-27T12:00:00Z'),
    })
    assert.equal(step.key, 'DAY_OF')
    assert.equal(step.messageKey, 'guestNextSteps_dayOfWithPack')
    assert.equal(step.showChat, true)
    assert.equal(step.showPay, false)
  })

  it('keeps pay step for AWAITING_PAYMENT', async () => {
    const { resolveGuestNextStepsStep } = await import('../lib/guest/resolve-guest-next-steps.js')
    const step = resolveGuestNextStepsStep({ status: 'AWAITING_PAYMENT' })
    assert.equal(step.key, 'AWAITING_PAYMENT')
    assert.equal(step.showPay, true)
  })
})

describe('access-pack-offline-cache', () => {
  const mem = new Map()

  beforeEach(() => {
    mem.clear()
    globalThis.window = {
      localStorage: {
        getItem: (k) => (mem.has(k) ? mem.get(k) : null),
        setItem: (k, v) => mem.set(k, String(v)),
        removeItem: (k) => mem.delete(k),
      },
    }
  })

  afterEach(() => {
    delete globalThis.window
  })

  it('writes and merges empty live fields from cache', async () => {
    const {
      writeAccessPackOfflineCache,
      mergeAccessPackWithOfflineCache,
    } = await import('../lib/orders/access-pack-offline-cache.js')

    writeAccessPackOfflineCache('bk-1', {
      visible: true,
      exactAddress: '12 Beach Rd',
      locationLabel: 'Rawai',
      accessCode: '4455',
      instructionsText: 'Gate left',
      photoUrls: [],
      chatHref: '/messages/c1',
    })

    const merged = mergeAccessPackWithOfflineCache('bk-1', {
      visible: true,
      exactAddress: '',
      locationLabel: '',
      accessCode: '',
      instructionsText: '',
      photoUrls: [],
      chatHref: null,
    })
    assert.equal(merged.exactAddress, '12 Beach Rd')
    assert.equal(merged.accessCode, '4455')
    assert.equal(merged.fromOfflineCache, true)
  })

  it('returns cached pack when live not visible only while offline', async () => {
    const {
      writeAccessPackOfflineCache,
      mergeAccessPackWithOfflineCache,
    } = await import('../lib/orders/access-pack-offline-cache.js')

    writeAccessPackOfflineCache('bk-2', {
      visible: true,
      exactAddress: 'Offline St 1',
      locationLabel: '',
      accessCode: '',
      instructionsText: '',
      photoUrls: [],
      chatHref: '/messages/c2',
    })

    const online = mergeAccessPackWithOfflineCache('bk-2', { visible: false })
    assert.equal(online.visible, false)

    const prevDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { onLine: false },
    })
    try {
      const offline = mergeAccessPackWithOfflineCache('bk-2', { visible: false })
      assert.equal(offline.visible, true)
      assert.equal(offline.exactAddress, 'Offline St 1')
      assert.equal(offline.fromOfflineCache, true)
    } finally {
      if (prevDesc) Object.defineProperty(globalThis, 'navigator', prevDesc)
      else delete globalThis.navigator
    }
  })
})
