'use client'

/**
 * Тот же контракт, что `persistPendingReferralCode` в **`contexts/auth-context.jsx`**
 * (cookie `gostaylo_pending_ref` + localStorage) — для лендинга `/u/[id]` без циклических импортов.
 */

const PENDING_REF_COOKIE = 'gostaylo_pending_ref'
const PENDING_REF_LS = 'gostaylo_pending_ref_code'

/** @param {string} codeRaw */
function getStableReferralFingerprint() {
  try {
    const existing = localStorage.getItem('gostaylo_ref_fingerprint')
    if (existing) return existing
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'na'
    const raw = [
      navigator.userAgent || 'ua',
      navigator.language || 'lang',
      navigator.platform || 'platform',
      String(window.screen?.width || 0),
      String(window.screen?.height || 0),
      tz,
    ].join('|')
    const fp = btoa(unescape(encodeURIComponent(raw))).slice(0, 160)
    localStorage.setItem('gostaylo_ref_fingerprint', fp)
    return fp
  } catch {
    return null
  }
}

function trackReferralClickFromLanding(code, landingPath) {
  try {
    const fp = getStableReferralFingerprint()
    const qs = new URLSearchParams({ code })
    if (landingPath) qs.set('path', String(landingPath).slice(0, 500))
    if (fp) qs.set('fingerprint', fp)
    void fetch(`/api/v2/referral/track?${qs.toString()}`, { credentials: 'same-origin' })
  } catch {
    /* ignore */
  }
}

export function persistPendingReferralFromLanding(codeRaw) {
  const code = String(codeRaw || '').trim().toUpperCase()
  if (!code || typeof window === 'undefined') return
  try {
    localStorage.setItem(PENDING_REF_LS, code)
    const secure = window.location.protocol === 'https:'
    document.cookie = `${PENDING_REF_COOKIE}=${encodeURIComponent(code)}; Path=/; Max-Age=${60 * 60 * 24 * 120}; SameSite=Lax${secure ? '; Secure' : ''}`
    trackReferralClickFromLanding(code, window.location.pathname || '/')
  } catch {
    /* ignore */
  }
}
