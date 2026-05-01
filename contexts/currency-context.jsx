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
 *   Только если юзер САМ не выбирал валюту.
 *
 * @refactor 2026-02 Убрали setState-in-effect:
 *   - state = ТОЛЬКО явный выбор пользователя (userChoice), хранится в localStorage.
 *   - currency = useMemo(userChoice ?? countryToCurrency(country) ?? DEFAULT).
 *   - useEffect только для side-effects (localStorage/event), без setState.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useUserGeo } from '@/lib/hooks/useUserGeo'

const STORAGE_KEY = 'gostaylo_currency'
const EXPLICIT_KEY = 'gostaylo_currency_explicit' // '1' если юзер явно выбирал
const DEFAULT_CURRENCY = 'THB'
/** @deprecated — legacy event для старых слушателей */
const LEGACY_EVENT = 'currency-change'

/** Маппинг страны (ISO-2) → валюта. */
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
  if (!country) return null
  return COUNTRY_TO_CURRENCY[country.toUpperCase()] || null
}

/** Lazy-init reader — читает userChoice из localStorage один раз на mount. SSR-safe. */
function readUserChoice() {
  if (typeof window === 'undefined') return null
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved && typeof saved === 'string' ? saved : null
  } catch {
    return null
  }
}

const CurrencyContext = createContext(null)

export function CurrencyProvider({ children }) {
  // state = ЯВНЫЙ выбор пользователя (или null). Auto-geo никогда не пишет сюда.
  const [userChoice, setUserChoice] = useState(readUserChoice)
  const { country, isResolved } = useUserGeo()
  const geoPersistedRef = useRef(false)

  // Derived currency — приоритет: явный выбор → авто-гео → default
  const currency = useMemo(() => {
    if (userChoice) return userChoice
    const geoSuggest = countryToCurrency(country)
    if (geoSuggest) return geoSuggest
    return DEFAULT_CURRENCY
  }, [userChoice, country])

  // Side-effect: персистим auto-geo suggestion в localStorage (без setState!)
  // Это чтобы другие компоненты (вкладки) при чтении видели ту же валюту.
  useEffect(() => {
    if (geoPersistedRef.current) return
    if (!isResolved || !country) return
    if (typeof window === 'undefined') return
    try {
      const explicitlyChosen = localStorage.getItem(EXPLICIT_KEY) === '1'
      if (explicitlyChosen) {
        geoPersistedRef.current = true
        return
      }
      const suggested = countryToCurrency(country)
      if (!suggested) {
        geoPersistedRef.current = true
        return
      }
      const existing = localStorage.getItem(STORAGE_KEY)
      if (existing !== suggested) {
        localStorage.setItem(STORAGE_KEY, suggested)
        window.dispatchEvent(new CustomEvent(LEGACY_EVENT, { detail: suggested }))
      }
      geoPersistedRef.current = true
    } catch {
      /* ignore */
    }
  }, [isResolved, country])

  const setCurrency = useCallback((code, opts = {}) => {
    if (!code) return
    setUserChoice(code) // ← setState вне effect — OK
    try {
      localStorage.setItem(STORAGE_KEY, code)
      if (opts.explicit !== false) localStorage.setItem(EXPLICIT_KEY, '1')
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
