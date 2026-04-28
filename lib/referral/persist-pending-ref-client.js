'use client'

/**
 * Тот же контракт, что `persistPendingReferralCode` в **`contexts/auth-context.jsx`**
 * (cookie `gostaylo_pending_ref` + localStorage) — для лендинга `/u/[id]` без циклических импортов.
 */

const PENDING_REF_COOKIE = 'gostaylo_pending_ref'
const PENDING_REF_LS = 'gostaylo_pending_ref_code'

/** @param {string} codeRaw */
export function persistPendingReferralFromLanding(codeRaw) {
  const code = String(codeRaw || '').trim().toUpperCase()
  if (!code || typeof window === 'undefined') return
  try {
    localStorage.setItem(PENDING_REF_LS, code)
    const secure = window.location.protocol === 'https:'
    document.cookie = `${PENDING_REF_COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=${60 * 60 * 24 * 120}; SameSite=Lax${secure ? '; Secure' : ''}`
  } catch {
    /* ignore */
  }
}
