/**
 * Stage 202.18 — browser-only SSOT for cookie consent decision.
 */
import {
  COOKIE_CONSENT_EVENT,
  COOKIE_CONSENT_POLICY_VERSION,
  COOKIE_CONSENT_STORAGE_KEY,
} from './cookie-consent-config.js'

/**
 * @returns {number}
 */
export function getCurrentPolicyVersion() {
  return COOKIE_CONSENT_POLICY_VERSION
}

/**
 * @returns {{ necessary: boolean, all: boolean, version: number, at: string | null, method: 'banner' | 'auto_reject' | null } | null}
 */
export function getStoredConsent() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const method = parsed.method
    return {
      necessary: parsed.necessary === true,
      all: parsed.all === true,
      version: Number(parsed.version) || 0,
      at: typeof parsed.at === 'string' ? parsed.at : null,
      method: method === 'banner' || method === 'auto_reject' ? method : null,
    }
  } catch {
    return null
  }
}

/**
 * @param {{ all: boolean, method?: 'banner' }} opts
 */
export function setStoredConsent({ all, method = 'banner' }) {
  if (typeof localStorage === 'undefined') return
  const record = {
    necessary: true,
    all: all === true,
    version: COOKIE_CONSENT_POLICY_VERSION,
    at: new Date().toISOString(),
    method,
  }
  try {
    localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(record))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_EVENT, { detail: record }))
    }
  } catch {
    /* quota / private mode */
  }
}

export function clearStoredConsent() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/**
 * @returns {boolean}
 */
export function shouldShowBanner() {
  const stored = getStoredConsent()
  if (!stored) return true
  return stored.version < COOKIE_CONSENT_POLICY_VERSION
}

/**
 * PostHog / product analytics gate.
 * @returns {boolean}
 */
export function hasAnalyticsConsent() {
  const stored = getStoredConsent()
  if (!stored) return false
  if (stored.version < COOKIE_CONSENT_POLICY_VERSION) return false
  return stored.all === true
}
