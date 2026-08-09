/**
 * Stage 200.81 — soft snooze / never / manual eligibility + key migration.
 * Run: node --import ./scripts/node-test-alias-register.mjs --test __tests__/pwa-install-storage.test.js
 */
import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  PWA_COOLDOWN_DAYS,
  PWA_LONG_SNOOZE_DAYS,
  PWA_STORAGE_KEYS,
  PWA_STORAGE_PREFIX,
} from '@/lib/pwa/constants.js'
import {
  isPwaPromptNever,
  isPwaPromptSnoozed,
  readPwaBannerEligibility,
  readPwaManualPromptEligibility,
  readPwaPromptEligibility,
  setPwaPromptNever,
  snoozePwaPrompt,
} from '@/lib/pwa/pwa-install-storage.js'

describe('pwa-install-storage soft snooze', () => {
  const store = new Map()

  beforeEach(() => {
    store.clear()
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => {
        store.set(k, String(v))
      },
      removeItem: (k) => {
        store.delete(k)
      },
    }
    globalThis.sessionStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    }
    globalThis.window = {
      matchMedia: () => ({ matches: false }),
    }
    Object.defineProperty(globalThis, 'navigator', {
      value: { standalone: false },
      configurable: true,
      writable: true,
    })
  })

  afterEach(() => {
    delete globalThis.localStorage
    delete globalThis.sessionStorage
    delete globalThis.window
    try {
      delete globalThis.navigator
    } catch {
      /* getter-only in some Node versions */
    }
  })

  it('exports 5d short and 30d long snooze with airento_ prefix', () => {
    assert.equal(PWA_COOLDOWN_DAYS, 5)
    assert.equal(PWA_LONG_SNOOZE_DAYS, 30)
    assert.equal(PWA_STORAGE_PREFIX, 'airento_pwa_')
    assert.ok(PWA_STORAGE_KEYS.NEVER_UNTIL.startsWith('airento_pwa_'))
  })

  it('setPwaPromptNever is soft ~30d not forever', () => {
    setPwaPromptNever()
    assert.equal(isPwaPromptNever(), true)
    const until = Number(store.get('airento_pwa_prompt_never_until'))
    assert.ok(until > Date.now())
    const days = (until - Date.now()) / (24 * 60 * 60 * 1000)
    assert.ok(days > 29 && days < 31)
  })

  it('snooze is ~5 days', () => {
    snoozePwaPrompt()
    assert.equal(isPwaPromptSnoozed(), true)
    const until = Number(store.get('airento_pwa_prompt_snooze_until'))
    const days = (until - Date.now()) / (24 * 60 * 60 * 1000)
    assert.ok(days > 4.5 && days < 5.5)
  })

  it('manual eligibility ignores never', () => {
    setPwaPromptNever()
    assert.equal(readPwaPromptEligibility().eligible, false)
    assert.equal(readPwaBannerEligibility().eligible, false)
    assert.equal(readPwaManualPromptEligibility().eligible, true)
  })

  it('migrates legacy gostaylo_pwa_ snooze to airento_pwa_', () => {
    const until = Date.now() + 3 * 24 * 60 * 60 * 1000
    store.set('gostaylo_pwa_prompt_snooze_until', String(until))
    assert.equal(isPwaPromptSnoozed(), true)
    assert.equal(store.has('airento_pwa_prompt_snooze_until'), true)
    assert.equal(store.has('gostaylo_pwa_prompt_snooze_until'), false)
  })
})
