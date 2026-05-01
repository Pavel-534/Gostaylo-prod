'use client'

/**
 * CurrencyContext — единый источник истины для валюты (SSOT).
 * Заменяет разрозненные localStorage + custom events в Header, GostayloHomeContent и CurrencySelector.
 *
 * @updated 2026-02 Global Engagement — auto-currency by geo (useUserGeo):
 *   RU/BY/UA/KZ/AM/KG/TJ/UZ → RUB
 *   TH                       → THB
 *   CN/HK                    → CNY
 *   EU (DE/FR/IT/ES/NL/...)  → EUR
 *   default (US/GB/...)      → USD
 *   Только если юзер САМ не выбирал валюту (no localStorage entry).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useUserGeo } from '@/lib/hooks/useUserGeo'

const STORAGE_KEY = 'gostaylo_currency'
const EXPLICIT_KEY = 'gostaylo_currency_explicit' // set to '1' when user manually picks currency
const DEFAULT_CURRENCY = 'THB'
/** @deprecated — оставлен для обратной совместимости со старыми слушателями */
const LEGACY_EVENT = 'currency-change'

/** Маппинг страны (ISO-2) → валюта. Покрывает основные регионы. */
const COUNTRY_TO_CURRENCY = {
  // RU-зона → RUB
  RU: 'RUB', BY: 'RUB', UA: 'RUB', KZ: 'RUB', AM: 'RUB', KG: 'RUB', TJ: 'RUB', UZ: 'RUB', MD: 'RUB',
  // Thailand → THB
  TH: 'THB',
  // CN / HK → CNY
  CN: 'CNY', HK: 'CNY', MO: 'CNY', TW: 'CNY',
  // Eurozone (major)
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR', IE: 'EUR',
  PT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR', SK: 'EUR', SI: 'EUR', EE: 'EUR', LV: 'EUR',
  LT: 'EUR', CY: 'EUR', MT: 'EUR', HR: 'EUR',
}

export function countryToCurrency(country) {
  if (!country) return 'USD'
  return COUNTRY_TO_CURRENCY[country.toUpperCase()] || 'USD'
}

const CurrencyContext = createContext(null)

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState(DEFAULT_CURRENCY)
  const initializedRef = useRef(false)
  const { country, isResolved } = useUserGeo()

  // Инициализация из localStorage (только клиент)
  useEffect(() => {
    if (initializedRef.current) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrencyState(saved)
        initializedRef.current = true
      }
    } catch {
      /* SSR guard */
    }
  }, [])

  // Auto-currency by geo — только если user не выбирал явно и localStorage пуст
  useEffect(() => {
    if (!isResolved || !country) return
    if (initializedRef.current) return
    try {
      const explicitlyChosen = localStorage.getItem(EXPLICIT_KEY) === '1'
      const saved = localStorage.getItem(STORAGE_KEY)
      if (explicitlyChosen || saved) {
        initializedRef.current = true
        return
      }
    } catch {
      /* SSR guard */
    }
    const suggested = countryToCurrency(country)
    setCurrencyState(suggested)
    try {
      localStorage.setItem(STORAGE_KEY, suggested)
      // НЕ помечаем EXPLICIT_KEY — это автоматический выбор, юзер может поменять
      window.dispatchEvent(new CustomEvent(LEGACY_EVENT, { detail: suggested }))
    } catch {
      /* SSR guard */
    }
    initializedRef.current = true
  }, [isResolved, country])

  const setCurrency = useCallback((code, opts = {}) => {
    if (!code) return
    setCurrencyState(code)
    try {
      localStorage.setItem(STORAGE_KEY, code)
      // Помечаем что юзер выбрал ЯВНО — auto-geo больше не перезаписывает
      if (opts.explicit !== false) localStorage.setItem(EXPLICIT_KEY, '1')
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
