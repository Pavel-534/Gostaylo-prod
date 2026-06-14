'use client'

import { useEffect } from 'react'
import { getAuthErrorMessage, getUIText } from '@/lib/translations'
import { trackProductEvent, ProductAnalyticsEvents } from '@/lib/analytics/product-analytics.js'

/** Persisted referral for landing `?ref=` + OAuth/email continuation (Stage 72.6). */
export const PENDING_REF_COOKIE = 'gostaylo_pending_ref'
export const PENDING_REF_LS = 'gostaylo_pending_ref_code'

export function readPendingRefFromCookie() {
  if (typeof document === 'undefined') return ''
  try {
    const row = document.cookie.split(';').map((s) => s.trim())
    const hit = row.find((c) => c.startsWith(`${PENDING_REF_COOKIE}=`))
    if (!hit) return ''
    const raw = decodeURIComponent(hit.slice(PENDING_REF_COOKIE.length + 1))
    return String(raw || '').trim()
  } catch {
    return ''
  }
}

/** Client-side check: cookie or localStorage still holds a pending referral code. */
export function hasPendingReferralClient() {
  if (typeof window === 'undefined') return false
  try {
    const fromCookie = readPendingRefFromCookie()
    const fromLs = localStorage.getItem(PENDING_REF_LS)?.trim()
    return Boolean(fromCookie || fromLs)
  } catch {
    return false
  }
}

export function persistPendingReferralCode(codeRaw) {
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

/** Stage 120.0 — server-side click attribution (cookie gostaylo_ref, HttpOnly). */
export function trackReferralClick(codeRaw, landingPath = '') {
  const code = String(codeRaw || '').trim().toUpperCase()
  if (!code || typeof window === 'undefined') return
  try {
    const fp = getStableReferralFingerprint()
    const qs = new URLSearchParams({ code })
    const path = String(landingPath || window.location.pathname || '').trim()
    if (path) qs.set('path', path.slice(0, 500))
    if (fp) qs.set('fingerprint', fp)
    const params = new URLSearchParams(window.location.search)
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign']) {
      const v = params.get(key)
      if (v) qs.set(key, v)
    }
    void fetch(`/api/v2/referral/track?${qs.toString()}`, { credentials: 'same-origin' })
  } catch {
    /* ignore */
  }
}

export function getStableReferralFingerprint() {
  if (typeof window === 'undefined') return null
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

/** Capture `?ref=` on load and sync cookie/localStorage so OAuth/email flows cannot drop the referrer. */
export function useReferralCapture({
  language,
  setPromoCode,
  setPromoStatus,
  setPromoMessage,
}) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      const fromUrl = params.get('ref')?.trim()
      const fromCookie = readPendingRefFromCookie()
      const fromLs = localStorage.getItem(PENDING_REF_LS)?.trim()
      const picked = fromUrl || fromCookie || fromLs || ''
      if (!picked) return
      persistPendingReferralCode(picked)
      trackReferralClick(picked, window.location.pathname || '/')
      void trackProductEvent(ProductAnalyticsEvents.REFERRAL_CAPTURED, {
        source: fromUrl ? 'url' : fromCookie ? 'cookie' : 'localStorage',
      })
      setPromoCode(String(picked).trim().toUpperCase())
      setPromoStatus('checking')
      setPromoMessage('')
      void fetch('/api/v2/referral/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: String(picked).trim().toUpperCase(),
          email: '',
          fingerprint: getStableReferralFingerprint(),
        }),
      })
        .then(async (res) => {
          const json = await res.json().catch(() => ({}))
          if (res.ok && json?.valid) {
            setPromoStatus('valid')
            setPromoMessage(getUIText('auth_referral_landingSaved', language))
          } else {
            setPromoStatus('invalid')
            setPromoMessage(getAuthErrorMessage(json?.error_code, language))
          }
        })
        .catch(() => {
          setPromoStatus('invalid')
          setPromoMessage(getUIText('auth_referral_landingCheckFailed', language))
        })
    } catch {
      /* ignore */
    }
  }, [language, setPromoCode, setPromoStatus, setPromoMessage])
}
