/** Stage 169.4 — Smart PWA install prompt thresholds (Wave G P2). */

export const PWA_STORAGE_PREFIX = 'gostaylo_pwa_'

export const PWA_STORAGE_KEYS = Object.freeze({
  NEVER: `${PWA_STORAGE_PREFIX}prompt_never`,
  SNOOZE_UNTIL: `${PWA_STORAGE_PREFIX}prompt_snooze_until`,
  LAST_SHOWN_AT: `${PWA_STORAGE_PREFIX}prompt_last_shown_at`,
  SHOWN_COUNT: `${PWA_STORAGE_PREFIX}prompt_shown_count`,
  VISIT_DAYS: `${PWA_STORAGE_PREFIX}visit_days`,
  LAST_VISIT_DAY: `${PWA_STORAGE_PREFIX}last_visit_day`,
  PDP_VIEWS: `${PWA_STORAGE_PREFIX}pdp_views`,
  MAP_OPENS: `${PWA_STORAGE_PREFIX}map_opens`,
})

export const PWA_MIN_VISIT_DAYS = 2
export const PWA_MIN_PDP_VIEWS = 2
export const PWA_MIN_MAP_OPENS = 1
export const PWA_COOLDOWN_DAYS = 10
export const PWA_PROMPT_DELAY_MS = 4000

export const PWA_SESSION_SHOWN_KEY = 'gostaylo_pwa_prompt_shown_session'
