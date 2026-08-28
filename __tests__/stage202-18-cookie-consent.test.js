/**
 * Stage 202.18 — cookie consent state + PostHog gate contract.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  COOKIE_CONSENT_POLICY_VERSION,
  COOKIE_CONSENT_STORAGE_KEY,
} from '../lib/consent/cookie-consent-config.js'
import {
  clearStoredConsent,
  getStoredConsent,
  hasAnalyticsConsent,
  setStoredConsent,
  shouldShowBanner,
} from '../lib/consent/cookie-consent-state.js'

const root = process.cwd()

function withMockLocalStorage(run) {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      store.set(k, String(v))
    },
    removeItem: (k) => {
      store.delete(k)
    },
    clear: () => {
      store.clear()
    },
  }
  try {
    return run()
  } finally {
    delete globalThis.localStorage
  }
}

test('getStoredConsent returns null when localStorage empty', () => {
  withMockLocalStorage(() => {
    clearStoredConsent()
    assert.equal(getStoredConsent(), null)
  })
})

test('setStoredConsent({all: true}) + hasAnalyticsConsent() → true', () => {
  withMockLocalStorage(() => {
    clearStoredConsent()
    setStoredConsent({ all: true })
    assert.equal(hasAnalyticsConsent(), true)
    const stored = getStoredConsent()
    assert.equal(stored.all, true)
    assert.equal(stored.necessary, true)
    assert.equal(stored.version, COOKIE_CONSENT_POLICY_VERSION)
  })
})

test('setStoredConsent({all: false}) + hasAnalyticsConsent() → false', () => {
  withMockLocalStorage(() => {
    clearStoredConsent()
    setStoredConsent({ all: false })
    assert.equal(hasAnalyticsConsent(), false)
  })
})

test('shouldShowBanner() true on first visit, false after decision', () => {
  withMockLocalStorage(() => {
    clearStoredConsent()
    assert.equal(shouldShowBanner(), true)
    setStoredConsent({ all: false })
    assert.equal(shouldShowBanner(), false)
  })
})

test('bumping COOKIE_CONSENT_POLICY_VERSION triggers re-prompt', () => {
  withMockLocalStorage(() => {
    clearStoredConsent()
    setStoredConsent({ all: true })
    localStorage.setItem(
      COOKIE_CONSENT_STORAGE_KEY,
      JSON.stringify({
        necessary: true,
        all: true,
        version: COOKIE_CONSENT_POLICY_VERSION - 1,
        at: '2026-01-01T00:00:00.000Z',
        method: 'banner',
      }),
    )
    assert.equal(shouldShowBanner(), true)
    assert.equal(hasAnalyticsConsent(), false)
  })
})

test('clearStoredConsent resets state', () => {
  withMockLocalStorage(() => {
    setStoredConsent({ all: true })
    assert.notEqual(getStoredConsent(), null)
    clearStoredConsent()
    assert.equal(getStoredConsent(), null)
    assert.equal(shouldShowBanner(), true)
  })
})

test('product-analytics gates PostHog on hasAnalyticsConsent', () => {
  const src = readFileSync(join(root, 'lib/analytics/product-analytics.js'), 'utf8')
  assert.match(src, /hasAnalyticsConsent/)
  assert.match(src, /cookie-consent-state/)
})

test('CookieConsent banner + ProductAnalyticsInit consent event wiring', () => {
  const banner = readFileSync(join(root, 'components/CookieConsent.jsx'), 'utf8')
  const init = readFileSync(join(root, 'components/analytics/ProductAnalyticsInit.jsx'), 'utf8')
  assert.match(banner, /cookie-consent-banner/)
  assert.match(banner, /shouldShowBanner/)
  assert.match(init, /COOKIE_CONSENT_EVENT/)
})
