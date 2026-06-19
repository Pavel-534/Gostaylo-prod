import {
  PWA_COOLDOWN_DAYS,
  PWA_MIN_MAP_OPENS,
  PWA_MIN_PDP_VIEWS,
  PWA_MIN_VISIT_DAYS,
  PWA_SESSION_SHOWN_KEY,
  PWA_STORAGE_KEYS,
} from '@/lib/pwa/constants.js'

function readNumber(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return 0
    const n = Number(raw)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

function writeNumber(key, value) {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    /* quota */
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * @returns {{ visitDays: number, pdpViews: number, mapOpens: number }}
 */
export function readPwaEngagement() {
  return {
    visitDays: readNumber(PWA_STORAGE_KEYS.VISIT_DAYS),
    pdpViews: readNumber(PWA_STORAGE_KEYS.PDP_VIEWS),
    mapOpens: readNumber(PWA_STORAGE_KEYS.MAP_OPENS),
  }
}

/** Increment unique visit day (once per calendar day). */
export function recordPwaVisitDay() {
  if (typeof window === 'undefined') return
  const day = todayKey()
  const last = localStorage.getItem(PWA_STORAGE_KEYS.LAST_VISIT_DAY)
  if (last === day) return
  localStorage.setItem(PWA_STORAGE_KEYS.LAST_VISIT_DAY, day)
  writeNumber(PWA_STORAGE_KEYS.VISIT_DAYS, readNumber(PWA_STORAGE_KEYS.VISIT_DAYS) + 1)
}

/**
 * @param {'pdp_view' | 'map_open'} kind
 */
export function recordPwaEngagement(kind) {
  if (typeof window === 'undefined') return
  if (kind === 'pdp_view') {
    writeNumber(PWA_STORAGE_KEYS.PDP_VIEWS, readNumber(PWA_STORAGE_KEYS.PDP_VIEWS) + 1)
    return
  }
  if (kind === 'map_open') {
    writeNumber(PWA_STORAGE_KEYS.MAP_OPENS, readNumber(PWA_STORAGE_KEYS.MAP_OPENS) + 1)
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
 * @returns {boolean}
 */
export function isPwaPromptNever() {
  try {
    return localStorage.getItem(PWA_STORAGE_KEYS.NEVER) === '1'
  } catch {
    return false
  }
}

export function setPwaPromptNever() {
  try {
    localStorage.setItem(PWA_STORAGE_KEYS.NEVER, '1')
  } catch {
    /* ignore */
  }
}

/**
 * @returns {boolean}
 */
export function isPwaPromptSnoozed() {
  try {
    const raw = localStorage.getItem(PWA_STORAGE_KEYS.SNOOZE_UNTIL)
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
  try {
    localStorage.setItem(PWA_STORAGE_KEYS.SNOOZE_UNTIL, String(until))
  } catch {
    /* ignore */
  }
}

export function markPwaPromptShown() {
  try {
    localStorage.setItem(PWA_STORAGE_KEYS.LAST_SHOWN_AT, String(Date.now()))
    writeNumber(PWA_STORAGE_KEYS.SHOWN_COUNT, readNumber(PWA_STORAGE_KEYS.SHOWN_COUNT) + 1)
  } catch {
    /* ignore */
  }
}

/**
 * @returns {number}
 */
export function readPwaPromptShownCount() {
  return readNumber(PWA_STORAGE_KEYS.SHOWN_COUNT)
}

/**
 * @returns {boolean}
 */
export function wasPwaPromptShownThisSession() {
  try {
    return sessionStorage.getItem(PWA_SESSION_SHOWN_KEY) === '1'
  } catch {
    return false
  }
}

export function markPwaPromptShownThisSession() {
  try {
    sessionStorage.setItem(PWA_SESSION_SHOWN_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function readPwaPromptEligibility() {
  if (isPwaPromptNever()) return { eligible: false, reason: 'never' }
  if (isPwaPromptSnoozed()) return { eligible: false, reason: 'snooze' }
  if (wasPwaPromptShownThisSession()) return { eligible: false, reason: 'session' }
  const engagement = readPwaEngagement()
  if (!hasPwaEngagementThreshold(engagement)) {
    return { eligible: false, reason: 'engagement', engagement }
  }
  return { eligible: true, engagement }
}
