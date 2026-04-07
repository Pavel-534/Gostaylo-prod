/**
 * GoStayLo - Currency Hook
 * Курсы: GET /api/v2/exchange-rates (rateMap = THB за 1 единицу валюты), канон с CurrencyService.
 */

'use client'

import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { formatPrice } from '@/lib/currency'
import { detectLanguage } from '@/lib/translations'

const CurrencyContext = createContext(null)

const CURRENCIES = {
  THB: { symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
  USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  RUB: { symbol: '₽', name: 'Russian Ruble', flag: '🇷🇺' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
  EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺' },
  GBP: { symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  JPY: { symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' },
  KRW: { symbol: '₩', name: 'Korean Won', flag: '🇰🇷' },
  INR: { symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳' },
  USDT: { symbol: '₮', name: 'Tether', flag: '💎' },
}

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState('THB')
  const [rateMap, setRateMap] = useState(null)
  const [loading, setLoading] = useState(true)
  const [geoData, setGeoData] = useState(null)

  useEffect(() => {
    const init = async () => {
      try {
        const savedCurrency = localStorage.getItem('gostaylo_currency')

        if (savedCurrency && CURRENCIES[savedCurrency]) {
          setCurrency(savedCurrency)
        } else {
          const geoRes = await fetch('/api/v2/geo')
          const geoJson = await geoRes.json()

          if (geoJson.success && geoJson.currency?.code) {
            setCurrency(geoJson.currency.code)
            setGeoData(geoJson.location)
          }
        }

        const ratesRes = await fetch('/api/v2/exchange-rates', { cache: 'no-store' })
        const ratesJson = await ratesRes.json()

        if (ratesJson.success && ratesJson.rateMap && typeof ratesJson.rateMap === 'object') {
          setRateMap({ THB: 1, ...ratesJson.rateMap })
        }
      } catch (error) {
        console.error('[CURRENCY] Init error:', error)
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [])

  const changeCurrency = useCallback((newCurrency) => {
    if (CURRENCIES[newCurrency]) {
      setCurrency(newCurrency)
      localStorage.setItem('gostaylo_currency', newCurrency)
    }
  }, [])

  const convert = useCallback(
    (amountThb) => {
      if (rateMap == null || currency === 'THB') return amountThb
      const r = rateMap[currency]
      if (r == null || !Number.isFinite(r) || r <= 0) return amountThb
      return amountThb / r
    },
    [rateMap, currency],
  )

  const formatPriceHook = useCallback(
    (amountThb, options = {}) => {
      const { showOriginal = false } = options
      const rates = rateMap || { THB: 1 }
      const lang = detectLanguage()
      const formatted = formatPrice(amountThb, currency, rates, lang)
      if (showOriginal && currency !== 'THB') {
        const thbFmt = formatPrice(amountThb, 'THB', { THB: 1 }, lang)
        return `${formatted} (${thbFmt})`
      }
      return formatted
    },
    [currency, rateMap],
  )

  const value = {
    currency,
    setCurrency: changeCurrency,
    currencyInfo: CURRENCIES[currency] || CURRENCIES.THB,
    rates: rateMap,
    loading,
    geoData,
    convert,
    formatPrice: formatPriceHook,
    currencies: Object.entries(CURRENCIES).map(([code, info]) => ({ code, ...info })),
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const context = useContext(CurrencyContext)
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider')
  }
  return context
}

export function useAutoDetectCurrency() {
  const [currency, setCurrency] = useState('THB')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const detect = async () => {
      try {
        const saved = localStorage.getItem('gostaylo_currency')
        if (saved) {
          setCurrency(saved)
          setLoading(false)
          return
        }

        const res = await fetch('/api/v2/geo')
        const data = await res.json()

        if (data.success && data.currency?.code) {
          setCurrency(data.currency.code)
          localStorage.setItem('gostaylo_currency', data.currency.code)
        }
      } catch (e) {
        console.error('[GEO] Detection failed:', e)
      } finally {
        setLoading(false)
      }
    }

    detect()
  }, [])

  return { currency, loading }
}

export default useCurrency
