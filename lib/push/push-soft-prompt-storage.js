/**
 * Stage 189.38 — one-tap push permission soft prompt snooze (localStorage).
 */

export const PUSH_SOFT_PROMPT_SNOOZE_KEY = 'gostaylo_push_soft_prompt_snooze_until'
export const PUSH_SOFT_PROMPT_NEVER_KEY = 'gostaylo_push_soft_prompt_never'

const DEFAULT_SNOOZE_DAYS = 7

function readNumber(key) {
  if (typeof localStorage === 'undefined') return 0
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
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(key, String(value))
  } catch {
    /* quota */
  }
}

function removeKey(key) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/**
 * @param {number} [now]
 * @returns {boolean}
 */
export function isPushSoftPromptSnoozed(now = Date.now()) {
  if (readNumber(PUSH_SOFT_PROMPT_NEVER_KEY) === 1) return true
  const until = readNumber(PUSH_SOFT_PROMPT_SNOOZE_KEY)
  return until > 0 && now < until
}

/**
 * @param {number} [days]
 */
export function snoozePushSoftPrompt(days = DEFAULT_SNOOZE_DAYS) {
  const until = Date.now() + days * 24 * 60 * 60 * 1000
  writeNumber(PUSH_SOFT_PROMPT_SNOOZE_KEY, until)
}

export function dismissPushSoftPromptForever() {
  writeNumber(PUSH_SOFT_PROMPT_NEVER_KEY, 1)
  removeKey(PUSH_SOFT_PROMPT_SNOOZE_KEY)
}

export function clearPushSoftPromptSnoozeForTests() {
  removeKey(PUSH_SOFT_PROMPT_SNOOZE_KEY)
  removeKey(PUSH_SOFT_PROMPT_NEVER_KEY)
}
