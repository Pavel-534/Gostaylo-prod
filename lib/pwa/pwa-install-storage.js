import {
  PWA_COOLDOWN_DAYS,
  PWA_LONG_SNOOZE_DAYS,
  PWA_MIN_MAP_OPENS,
  PWA_MIN_PDP_VIEWS,
  PWA_MIN_VISIT_DAYS,
  PWA_SESSION_SHOWN_KEY,
  PWA_SESSION_SHOWN_KEY_LEGACY,
  PWA_STORAGE_KEYS,
} from '@/lib/pwa/constants.js'
import { isStandaloneDisplayMode } from '@/lib/pwa/pwa-platform.js'

/**
 * Read localStorage with one-shot migrate legacy → canonical key.
 * @param {string} key
 * @param {string} [legacyKey]
 * @returns {string | null}
 */
function readMigratedItem(key, legacyKey) {
  try {
    const current = localStorage.getItem(key)
    if (current != null) return current
    if (!legacyKey) return null
    const legacy = localStorage.getItem(legacyKey)
    if (legacy == null) return null
    localStorage.setItem(key, legacy)
    localStorage.removeItem(legacyKey)
    return legacy
  } catch {
    return null
  }
}

function writeItem(key, value, legacyKey) {
  try {
    localStorage.setItem(key, String(value))
    if (legacyKey) localStorage.removeItem(legacyKey)
  } catch {
    /* quota */
  }
}

function removeItem(key, legacyKey) {
  try {
    localStorage.removeItem(key)
    if (legacyKey) localStorage.removeItem(legacyKey)
  } catch {
    /* ignore */
  }
}

function readNumber(key, legacyKey) {
  const raw = readMigratedItem(key, legacyKey)
  if (raw == null) return 0
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

function writeNumber(key, value, legacyKey) {
  writeItem(key, value, legacyKey)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * @returns {{ visitDays: number, pdpViews: number, mapOpens: number }}
 */
export function readPwaEngagement() {
  return {
    visitDays: readNumber(PWA_STORAGE_KEYS.VISIT_DAYS, PWA_STORAGE_KEYS.VISIT_DAYS_LEGACY),
    pdpViews: readNumber(PWA_STORAGE_KEYS.PDP_VIEWS, PWA_STORAGE_KEYS.PDP_VIEWS_LEGACY),
    mapOpens: readNumber(PWA_STORAGE_KEYS.MAP_OPENS, PWA_STORAGE_KEYS.MAP_OPENS_LEGACY),
  }
}

/** Increment unique visit day (once per calendar day). */
export function recordPwaVisitDay() {
  if (typeof window === 'undefined') return
  const day = todayKey()
  const last = readMigratedItem(
    PWA_STORAGE_KEYS.LAST_VISIT_DAY,
    PWA_STORAGE_KEYS.LAST_VISIT_DAY_LEGACY,
  )
  if (last === day) return
  writeItem(PWA_STORAGE_KEYS.LAST_VISIT_DAY, day, PWA_STORAGE_KEYS.LAST_VISIT_DAY_LEGACY)
  writeNumber(
    PWA_STORAGE_KEYS.VISIT_DAYS,
    readNumber(PWA_STORAGE_KEYS.VISIT_DAYS, PWA_STORAGE_KEYS.VISIT_DAYS_LEGACY) + 1,
    PWA_STORAGE_KEYS.VISIT_DAYS_LEGACY,
  )
}

/**
 * @param {'pdp_view' | 'map_open'} kind
 */
export function recordPwaEngagement(kind) {
  if (typeof window === 'undefined') return
  if (kind === 'pdp_view') {
    writeNumber(
      PWA_STORAGE_KEYS.PDP_VIEWS,
      readNumber(PWA_STORAGE_KEYS.PDP_VIEWS, PWA_STORAGE_KEYS.PDP_VIEWS_LEGACY) + 1,
      PWA_STORAGE_KEYS.PDP_VIEWS_LEGACY,
    )
    return
  }
  if (kind === 'map_open') {
    writeNumber(
      PWA_STORAGE_KEYS.MAP_OPENS,
      readNumber(PWA_STORAGE_KEYS.MAP_OPENS, PWA_STORAGE_KEYS.MAP_OPENS_LEGACY) + 1,
      PWA_STORAGE_KEYS.MAP_OPENS_LEGACY,
    )
  }
}

/**
 * @param {{ visitDays: number, pdpViews: number, mapOpens: number }} engagement
 * @returns {boolean}
 */
export function hasPwaEngagementThreshold(engagement) {
  if (engagement.visitDays >= PWA_MIN_VISIT_DAYS) return true
  if (engagement.pdpViews >= PWA_MIN_PDP_VIEWS) return true
  if (engagement.mapOpens >= PWA_MIN_MAP_OPENS) return true
  return false
}

/**
 * Soft long-snooze («Больше не предлагать» ≈ 30 days). Migrates legacy NEVER=1.
 * @returns {boolean}
 */
export function isPwaPromptNever() {
  try {
    const untilRaw = readMigratedItem(
      PWA_STORAGE_KEYS.NEVER_UNTIL,
      PWA_STORAGE_KEYS.NEVER_UNTIL_LEGACY,
    )
    if (untilRaw) {
      const until = Number(untilRaw)
      if (Number.isFinite(until) && Date.now() < until) return true
      if (Number.isFinite(until) && Date.now() >= until) {
        removeItem(PWA_STORAGE_KEYS.NEVER_UNTIL, PWA_STORAGE_KEYS.NEVER_UNTIL_LEGACY)
        removeItem(PWA_STORAGE_KEYS.NEVER, PWA_STORAGE_KEYS.NEVER_LEGACY)
        return false
      }
    }
    const neverFlag = readMigratedItem(PWA_STORAGE_KEYS.NEVER, PWA_STORAGE_KEYS.NEVER_LEGACY)
    if (neverFlag === '1') {
      const until = Date.now() + PWA_LONG_SNOOZE_DAYS * 24 * 60 * 60 * 1000
      writeItem(PWA_STORAGE_KEYS.NEVER_UNTIL, until, PWA_STORAGE_KEYS.NEVER_UNTIL_LEGACY)
      removeItem(PWA_STORAGE_KEYS.NEVER, PWA_STORAGE_KEYS.NEVER_LEGACY)
      return true
    }
    return false
  } catch {
    return false
  }
}

/** Soft long snooze (~30 days), not forever. */
export function setPwaPromptNever() {
  const until = Date.now() + PWA_LONG_SNOOZE_DAYS * 24 * 60 * 60 * 1000
  writeItem(PWA_STORAGE_KEYS.NEVER_UNTIL, until, PWA_STORAGE_KEYS.NEVER_UNTIL_LEGACY)
  removeItem(PWA_STORAGE_KEYS.NEVER, PWA_STORAGE_KEYS.NEVER_LEGACY)
}

/**
 * @returns {boolean}
 */
export function isPwaPromptSnoozed() {
  try {
    const raw = readMigratedItem(
      PWA_STORAGE_KEYS.SNOOZE_UNTIL,
      PWA_STORAGE_KEYS.SNOOZE_UNTIL_LEGACY,
    )
    if (!raw) return false
    const until = Number(raw)
    if (!Number.isFinite(until)) return false
    return Date.now() < until
  } catch {
    return false
  }
}

export function snoozePwaPrompt() {
  const until = Date.now() + PWA_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
  writeItem(PWA_STORAGE_KEYS.SNOOZE_UNTIL, until, PWA_STORAGE_KEYS.SNOOZE_UNTIL_LEGACY)
}

export function markPwaPromptShown() {
  writeItem(PWA_STORAGE_KEYS.LAST_SHOWN_AT, Date.now(), PWA_STORAGE_KEYS.LAST_SHOWN_AT_LEGACY)
  writeNumber(
    PWA_STORAGE_KEYS.SHOWN_COUNT,
    readNumber(PWA_STORAGE_KEYS.SHOWN_COUNT, PWA_STORAGE_KEYS.SHOWN_COUNT_LEGACY) + 1,
    PWA_STORAGE_KEYS.SHOWN_COUNT_LEGACY,
  )
}

/**
 * @returns {number}
 */
export function readPwaPromptShownCount() {
  return readNumber(PWA_STORAGE_KEYS.SHOWN_COUNT, PWA_STORAGE_KEYS.SHOWN_COUNT_LEGACY)
}

/**
 * @returns {boolean}
 */
export function wasPwaPromptShownThisSession() {
  try {
    if (sessionStorage.getItem(PWA_SESSION_SHOWN_KEY) === '1') return true
    if (sessionStorage.getItem(PWA_SESSION_SHOWN_KEY_LEGACY) === '1') {
      sessionStorage.setItem(PWA_SESSION_SHOWN_KEY, '1')
      sessionStorage.removeItem(PWA_SESSION_SHOWN_KEY_LEGACY)
      return true
    }
    return false
  } catch {
    return false
  }
}

export function markPwaPromptShownThisSession() {
  try {
    sessionStorage.setItem(PWA_SESSION_SHOWN_KEY, '1')
    sessionStorage.removeItem(PWA_SESSION_SHOWN_KEY_LEGACY)
  } catch {
    /* ignore */
  }
}

/**
 * Shared auto-prompt gates (never / snooze / session / standalone).
 * @returns {{ eligible: boolean, reason?: string }}
 */
export function readPwaAutoPromptBaseEligibility() {
  if (typeof window === 'undefined') return { eligible: false, reason: 'ssr' }
  if (isStandaloneDisplayMode()) return { eligible: false, reason: 'standalone' }
  if (isPwaPromptNever()) return { eligible: false, reason: 'never' }
  if (isPwaPromptSnoozed()) return { eligible: false, reason: 'snooze' }
  if (wasPwaPromptShownThisSession()) return { eligible: false, reason: 'session' }
  return { eligible: true }
}

/**
 * Auto sheet: base + engagement.
 */
export function readPwaPromptEligibility() {
  const base = readPwaAutoPromptBaseEligibility()
  if (!base.eligible) return base
  const engagement = readPwaEngagement()
  if (!hasPwaEngagementThreshold(engagement)) {
    return { eligible: false, reason: 'engagement', engagement }
  }
  return { eligible: true, engagement }
}

/**
 * Home banner: base gates only (no heavy engagement) — awareness without first-day spam from sheet.
 */
export function readPwaBannerEligibility() {
  return readPwaAutoPromptBaseEligibility()
}

/**
 * Manual entry (settings / profile) — ignore never/snooze/session; only standalone blocks.
 */
export function readPwaManualPromptEligibility() {
  if (typeof window === 'undefined') return { eligible: false, reason: 'ssr' }
  if (isStandaloneDisplayMode()) return { eligible: false, reason: 'standalone' }
  return { eligible: true }
}
