'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_UI_LANGUAGE,
  detectLanguage,
  getUIText,
  setLanguage as persistLanguage,
  supportedLanguages,
} from '@/lib/translations'

const I18nContext = createContext(null)

const PREFERRED_LOCALE_DEBOUNCE_MS = 450

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_UI_LANGUAGE)
  const [authStatus, setAuthStatus] = useState('unknown')
  const languageRef = useRef(DEFAULT_UI_LANGUAGE)
  const persistLocaleTimerRef = useRef(null)

  const flushPersistPreferredLanguage = useCallback(async (code) => {
    if (authStatus === 'unauthenticated') return
    try {
      const r = await fetch('/api/v2/profile/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_language: code }),
      })
      if (r.ok) {
        window.dispatchEvent(new CustomEvent('gostaylo-refresh-session'))
        setAuthStatus('authenticated')
      } else if (r.status === 401) {
        setAuthStatus('unauthenticated')
      }
    } catch {
      /* non-blocking */
    }
  }, [authStatus])

  const schedulePersistPreferredLanguage = useCallback(
    (code) => {
      if (authStatus === 'unauthenticated') return
      if (persistLocaleTimerRef.current) {
        clearTimeout(persistLocaleTimerRef.current)
      }
      persistLocaleTimerRef.current = setTimeout(() => {
        persistLocaleTimerRef.current = null
        void flushPersistPreferredLanguage(code)
      }, PREFERRED_LOCALE_DEBOUNCE_MS)
    },
    [authStatus, flushPersistPreferredLanguage],
  )

  const setLanguage = useCallback(
    (next) => {
      if (!next) return
      const normalized = String(next).slice(0, 2).toLowerCase()
      const isSupported = supportedLanguages?.some((l) => l.code === normalized)
      const finalLang = isSupported ? normalized : DEFAULT_UI_LANGUAGE

      setLanguageState(finalLang)
      persistLanguage(finalLang)
      document.documentElement.lang = finalLang

      window.dispatchEvent(new CustomEvent('language-change', { detail: finalLang }))
      window.dispatchEvent(new CustomEvent('languageChange', { detail: finalLang })) // legacy

      if (authStatus !== 'unauthenticated') {
        schedulePersistPreferredLanguage(finalLang)
      }
    },
    [authStatus, schedulePersistPreferredLanguage],
  )

  useEffect(() => {
    languageRef.current = language
  }, [language])

  useEffect(() => {
    return () => {
      if (persistLocaleTimerRef.current) {
        clearTimeout(persistLocaleTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const local = detectLanguage()
    setLanguageState(local)
    languageRef.current = local
    persistLanguage(local)
    document.documentElement.lang = local

    ;(async () => {
      try {
        const res = await fetch('/api/v2/auth/me', { credentials: 'include' })
        if (res.status === 401) {
          setAuthStatus('unauthenticated')
          return
        }
        if (!res.ok || cancelled) return
        setAuthStatus('authenticated')
        const data = await res.json()
        const fromProfile = data?.user?.preferred_language || data?.user?.preferredLanguage
        if (!fromProfile) return
        const normalized = String(fromProfile).slice(0, 2).toLowerCase()
        if (!supportedLanguages?.some((l) => l.code === normalized)) return
        if (cancelled || normalized === languageRef.current) return
        setLanguageState(normalized)
        languageRef.current = normalized
        persistLanguage(normalized)
        document.documentElement.lang = normalized
      } catch {
        /* guest or network */
      }
    })()

    const handleLang = (e) => {
      const next = e?.detail
      if (!next) return
      const normalized = String(next).slice(0, 2).toLowerCase()
      if (normalized === languageRef.current) return
      setLanguageState(normalized)
      persistLanguage(normalized)
      document.documentElement.lang = normalized
    }

    window.addEventListener('language-change', handleLang)
    window.addEventListener('languageChange', handleLang)
    return () => {
      cancelled = true
      window.removeEventListener('language-change', handleLang)
      window.removeEventListener('languageChange', handleLang)
    }
  }, [])

  const t = useCallback((key) => getUIText(key, language), [language])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}
