'use client'

/**
 * useUserGeo — определение страны/региона пользователя при первом визите.
 *
 * Стратегия (от дешёвого к точному):
 *   1) localStorage cache — мгновенно, TTL 7 дней.
 *   2) IP-API geolocation (бесплатно, без ключа) — server-side endpoint
 *      `/api/v2/geo/whoami` (proxy для CORS-безопасности).
 *   3) Fallback — Accept-Language header или 'TH' default.
 *
 * Эффект для UX:
 *   • Юзер из РФ → POPULAR_DESTINATIONS будут с группой Россия наверху.
 *   • Юзер из TH → группа Таиланд первая.
 *
 * Returns:
 *   { country, isResolved } — country это ISO-2 (RU/TH/ID/AE/...), isResolved=true когда
 *   запрос завершён (успешно или с фолбэком).
 *
 * @created 2026-02 Global DB Sprint
 */

import { useEffect, useRef, useState } from 'react'

const CACHE_KEY = 'gostaylo_user_geo_v1'
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function readCache() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (!obj?.country || !obj?.ts) return null
    if (Date.now() - obj.ts > CACHE_TTL_MS) return null
    return obj
  } catch {
    return null
  }
}

function writeCache(country) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ country, ts: Date.now() }))
  } catch {
    // localStorage may be disabled (incognito quota / Safari) — ignore silently
  }
}

function fallbackFromAcceptLang() {
  // RU language → assume Russia. ZH → China. TH → Thailand. EN → US/Other.
  if (typeof navigator === 'undefined') return null
  const lang = (navigator.language || navigator.languages?.[0] || '').toLowerCase()
  if (lang.startsWith('ru')) return 'RU'
  if (lang.startsWith('th')) return 'TH'
  if (lang.startsWith('zh')) return 'CN'
  if (lang.startsWith('id')) return 'ID'
  return null
}

export function useUserGeo() {
  const [country, setCountry] = useState(null)
  const [isResolved, setResolved] = useState(false)
  const hasInitRef = useRef(false)

  // Effect: 1) cache 2) fetch /api/v2/geo/whoami 3) Accept-Language fallback
  useEffect(() => {
    if (hasInitRef.current) return
    hasInitRef.current = true
    let cancelled = false

    // 1) Cache hit — sync resolve immediately
    const cached = readCache()
    if (cached?.country) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCountry(cached.country)
      setResolved(true)
      return
    }

    // 2) Server-side IP geolocation
    fetch('/api/v2/geo/whoami', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return
        const c = (data?.country || '').toUpperCase()
        if (c && /^[A-Z]{2}$/.test(c)) {
          setCountry(c)
          writeCache(c)
        } else {
          // 3) Fallback to Accept-Language
          const fb = fallbackFromAcceptLang() || 'TH'
          setCountry(fb)
          writeCache(fb)
        }
        setResolved(true)
      })
      .catch(() => {
        if (cancelled) return
        const fb = fallbackFromAcceptLang() || 'TH'
        setCountry(fb)
        setResolved(true)
      })

    return () => { cancelled = true }
  }, [])

  return { country, isResolved }
}

export default useUserGeo
