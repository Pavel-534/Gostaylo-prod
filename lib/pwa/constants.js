/** Stage 169.4 / 200.81 — Smart PWA install prompt thresholds. */

/** Canonical prefix (Stage 200.81 polish). */
export const PWA_STORAGE_PREFIX = 'airento_pwa_'

/**
 * Legacy prefix — keep reading/migrating so snooze/never prefs survive rename.
 * (Internal id; not a product brand string.)
 */
export const PWA_STORAGE_PREFIX_LEGACY = 'gostaylo_pwa_'

function keyPair(suffix) {
  return {
    current: `${PWA_STORAGE_PREFIX}${suffix}`,
    legacy: `${PWA_STORAGE_PREFIX_LEGACY}${suffix}`,
  }
}

const NEVER_UNTIL = keyPair('prompt_never_until')
const NEVER = keyPair('prompt_never')
const SNOOZE_UNTIL = keyPair('prompt_snooze_until')
const LAST_SHOWN_AT = keyPair('prompt_last_shown_at')
const SHOWN_COUNT = keyPair('prompt_shown_count')
const VISIT_DAYS = keyPair('visit_days')
const LAST_VISIT_DAY = keyPair('last_visit_day')
const PDP_VIEWS = keyPair('pdp_views')
const MAP_OPENS = keyPair('map_opens')

export const PWA_STORAGE_KEYS = Object.freeze({
  /** Soft long-snooze until (ms). Legacy NEVER=1 migrated on read. */
  NEVER_UNTIL: NEVER_UNTIL.current,
  NEVER_UNTIL_LEGACY: NEVER_UNTIL.legacy,
  /** @deprecated migrated → NEVER_UNTIL */
  NEVER: NEVER.current,
  NEVER_LEGACY: NEVER.legacy,
  SNOOZE_UNTIL: SNOOZE_UNTIL.current,
  SNOOZE_UNTIL_LEGACY: SNOOZE_UNTIL.legacy,
  LAST_SHOWN_AT: LAST_SHOWN_AT.current,
  LAST_SHOWN_AT_LEGACY: LAST_SHOWN_AT.legacy,
  SHOWN_COUNT: SHOWN_COUNT.current,
  SHOWN_COUNT_LEGACY: SHOWN_COUNT.legacy,
  VISIT_DAYS: VISIT_DAYS.current,
  VISIT_DAYS_LEGACY: VISIT_DAYS.legacy,
  LAST_VISIT_DAY: LAST_VISIT_DAY.current,
  LAST_VISIT_DAY_LEGACY: LAST_VISIT_DAY.legacy,
  PDP_VIEWS: PDP_VIEWS.current,
  PDP_VIEWS_LEGACY: PDP_VIEWS.legacy,
  MAP_OPENS: MAP_OPENS.current,
  MAP_OPENS_LEGACY: MAP_OPENS.legacy,
})

/** Soft auto-prompt engagement (sheet). */
export const PWA_MIN_VISIT_DAYS = 2
export const PWA_MIN_PDP_VIEWS = 2
export const PWA_MIN_MAP_OPENS = 1

/** «Не сейчас» — short snooze for auto banner + sheet. */
export const PWA_COOLDOWN_DAYS = 5

/** «Больше не предлагать» — soft long snooze (not forever). */
export const PWA_LONG_SNOOZE_DAYS = 30

export const PWA_PROMPT_DELAY_MS = 4000

/** Safety dismiss if user cancels native install dialog (Samsung / Chrome). */
export const PWA_INSTALL_OVERLAY_TIMEOUT_MS = 18_000

export const PWA_SESSION_SHOWN_KEY = `${PWA_STORAGE_PREFIX}prompt_shown_session`
export const PWA_SESSION_SHOWN_KEY_LEGACY = `${PWA_STORAGE_PREFIX_LEGACY}prompt_shown_session`
