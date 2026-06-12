/**
 * Stage 131.4 — client session for vanity welcome funnel (/go → /u → home/register).
 */
const VANITY_WELCOME_SESSION_KEY = 'gostaylo_vanity_welcome_v1'

/** @param {{ vanity: string, ambassadorName?: string, welcomeBonusThb?: number }} payload */
export function persistVanityWelcomeSession(payload) {
  if (typeof window === 'undefined' || !payload?.vanity) return
  try {
    sessionStorage.setItem(
      VANITY_WELCOME_SESSION_KEY,
      JSON.stringify({
        vanity: String(payload.vanity).trim().toLowerCase(),
        ambassadorName: payload.ambassadorName ? String(payload.ambassadorName).trim() : null,
        welcomeBonusThb: Number(payload.welcomeBonusThb) || 500,
        savedAt: Date.now(),
      }),
    )
  } catch {
    /* ignore quota / private mode */
  }
}

/** @returns {{ vanity: string, ambassadorName?: string, welcomeBonusThb?: number } | null} */
export function readVanityWelcomeSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(VANITY_WELCOME_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.vanity) return null
    return parsed
  } catch {
    return null
  }
}

export function clearVanityWelcomeSession() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(VANITY_WELCOME_SESSION_KEY)
  } catch {
    /* ignore */
  }
}
