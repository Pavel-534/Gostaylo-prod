'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { detectLanguage, getUIText, setLanguage as persistLanguage, supportedLanguages } from '@/lib/translations'

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState('ru')

  const setLanguage = useCallback((next) => {
    if (!next) return
    const normalized = String(next).slice(0, 2).toLowerCase()
    const isSupported = supportedLanguages?.some(l => l.code === normalized)
    const finalLang = isSupported ? normalized : 'ru'

    setLanguageState(finalLang)
    persistLanguage(finalLang)
    document.documentElement.lang = finalLang

    window.dispatchEvent(new CustomEvent('language-change', { detail: finalLang }))
    window.dispatchEvent(new CustomEvent('languageChange', { detail: finalLang })) // legacy
  }, [])

  useEffect(() => {
    const initial = detectLanguage()
    setLanguageState(initial)
    persistLanguage(initial)
    document.documentElement.lang = initial

    const handleLang = (e) => {
      const next = e?.detail
      if (!next) return
      const normalized = String(next).slice(0, 2).toLowerCase()
      if (normalized === language) return
      setLanguageState(normalized)
      persistLanguage(normalized)
      document.documentElement.lang = normalized
    }

    window.addEventListener('language-change', handleLang)
    window.addEventListener('languageChange', handleLang)
    return () => {
      window.removeEventListener('language-change', handleLang)
      window.removeEventListener('languageChange', handleLang)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const t = useCallback((key) => getUIText(key, language), [language])

  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
  }), [language, setLanguage, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider')
  return ctx
}

