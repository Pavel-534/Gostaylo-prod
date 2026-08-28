/**
 * Stage 202.18 — pre-seed cookie consent for Playwright (avoid banner blocking UI).
 * Policy version must match `lib/consent/cookie-consent-config.js` COOKIE_CONSENT_POLICY_VERSION.
 */

import fs from 'node:fs'

export const E2E_COOKIE_CONSENT_POLICY_VERSION = 1

export const E2E_COOKIE_CONSENT_STORAGE_KEY = 'airento_cookie_consent'

export function buildE2eCookieConsentValue() {
  return JSON.stringify({
    necessary: true,
    all: true,
    version: E2E_COOKIE_CONSENT_POLICY_VERSION,
    at: '2026-01-01T00:00:00.000Z',
    method: 'banner',
  })
}

/**
 * Merge consent into Playwright storageState JSON (same pattern as gostaylo_user).
 */
export function mergeCookieConsentIntoStorageState(
  outFile: string,
  appOrigin: string,
  consentValue = buildE2eCookieConsentValue(),
) {
  const raw = fs.readFileSync(outFile, 'utf-8')
  const state = JSON.parse(raw) as {
    cookies?: unknown[]
    origins?: Array<{ origin: string; localStorage: Array<{ name: string; value: string }> }>
  }
  const origin = new URL(appOrigin).origin
  state.origins = state.origins || []
  let entry = state.origins.find((o) => o.origin === origin)
  if (!entry) {
    entry = { origin, localStorage: [] }
    state.origins.push(entry)
  }
  entry.localStorage = entry.localStorage || []
  const i = entry.localStorage.findIndex((x) => x.name === E2E_COOKIE_CONSENT_STORAGE_KEY)
  if (i >= 0) entry.localStorage[i].value = consentValue
  else entry.localStorage.push({ name: E2E_COOKIE_CONSENT_STORAGE_KEY, value: consentValue })
  fs.writeFileSync(outFile, JSON.stringify(state))
}

export function buildCookieConsentStorageStateForOrigin(appOrigin: string) {
  const origin = new URL(appOrigin).origin
  return {
    cookies: [] as unknown[],
    origins: [
      {
        origin,
        localStorage: [
          {
            name: E2E_COOKIE_CONSENT_STORAGE_KEY,
            value: buildE2eCookieConsentValue(),
          },
        ],
      },
    ],
  }
}
