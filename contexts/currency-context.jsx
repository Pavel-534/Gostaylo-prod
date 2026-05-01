'use client'

/**
 * CurrencyContext — единый источник истины для валюты (SSOT).
 * Заменяет разрозненные localStorage + custom events в Header, GostayloHomeContent и CurrencySelector.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'gostaylo_currency'
const DEFAULT_CURRENCY = 'THB'
/** @deprecated — оставлен для обратной совместимости со старыми слушателями */
const LEGACY_EVENT = 'currency-change'

const CurrencyContext = createContext(null)

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(DEFAULT_CURRENCY)

  // Инициализация из localStorage (только клиент)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setCurrencyState(saved)
    } catch {
      /* SSR guard */
    }
  }, [])

  const setCurrency = useCallback((code) => {
    if (!code) return
    setCurrencyState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
      // Legacy event — backward compat для старых подписчиков
      window.dispatchEvent(new CustomEvent(LEGACY_EVENT, { detail: code }))
    } catch {
      /* SSR guard */
    }
  }, [])

  const value = useMemo(() => ({ currency, setCurrency }), [currency, setCurrency])

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used within a CurrencyProvider')
  return ctx
}
