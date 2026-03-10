/**
 * Gostaylo - Currency Hook
 * Auto-detect user's currency and provide conversion utilities
 */

'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const CurrencyContext = createContext(null);

// Supported currencies with metadata
const CURRENCIES = {
  THB: { symbol: '฿', name: 'Thai Baht', flag: '🇹🇭' },
  USD: { symbol: '$', name: 'US Dollar', flag: '🇺🇸' },
  RUB: { symbol: '₽', name: 'Russian Ruble', flag: '🇷🇺' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳' },
  EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺' },
  GBP: { symbol: '£', name: 'British Pound', flag: '🇬🇧' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬' },
  JPY: { symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵' }
};

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState('THB');
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [geoData, setGeoData] = useState(null);

  // Load currency preference and rates on mount
  useEffect(() => {
    const init = async () => {
      try {
        // Check localStorage for saved preference
        const savedCurrency = localStorage.getItem('gostaylo_currency');
        
        if (savedCurrency && CURRENCIES[savedCurrency]) {
          setCurrency(savedCurrency);
        } else {
          // Auto-detect from geo
          const geoRes = await fetch('/api/v2/geo');
          const geoJson = await geoRes.json();
          
          if (geoJson.success && geoJson.currency?.code) {
            setCurrency(geoJson.currency.code);
            setGeoData(geoJson.location);
          }
        }

        // Fetch rates
        const ratesRes = await fetch('/api/v2/forex');
        const ratesJson = await ratesRes.json();
        
        if (ratesJson.success) {
          setRates(ratesJson.rates);
        }
      } catch (error) {
        console.error('[CURRENCY] Init error:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  // Save currency preference
  const changeCurrency = useCallback((newCurrency) => {
    if (CURRENCIES[newCurrency]) {
      setCurrency(newCurrency);
      localStorage.setItem('gostaylo_currency', newCurrency);
    }
  }, []);

  // Convert THB to user's currency (with GostayloRate markup already applied on server)
  const convert = useCallback((amountThb) => {
    if (!rates || currency === 'THB') return amountThb;
    
    const rate = rates[currency];
    if (!rate) return amountThb;
    
    // Apply 3.5% markup (GostayloRate)
    const funnyRate = rate * 1.035;
    return Math.round(amountThb * funnyRate * 100) / 100;
  }, [rates, currency]);

  // Format price in current currency
  const formatPrice = useCallback((amountThb, options = {}) => {
    const { showOriginal = false } = options;
    const converted = convert(amountThb);
    const info = CURRENCIES[currency] || CURRENCIES.THB;
    
    // Format with locale
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: currency === 'JPY' ? 0 : 2
    }).format(converted);

    const result = `${info.symbol}${formatted}`;
    
    if (showOriginal && currency !== 'THB') {
      return `${result} (฿${amountThb.toLocaleString()})`;
    }
    
    return result;
  }, [currency, convert]);

  const value = {
    currency,
    setCurrency: changeCurrency,
    currencyInfo: CURRENCIES[currency] || CURRENCIES.THB,
    rates,
    loading,
    geoData,
    convert,
    formatPrice,
    currencies: Object.entries(CURRENCIES).map(([code, info]) => ({ code, ...info }))
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return context;
}

// Standalone hook for components that don't need full context
export function useAutoDetectCurrency() {
  const [currency, setCurrency] = useState('THB');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const detect = async () => {
      try {
        const saved = localStorage.getItem('gostaylo_currency');
        if (saved) {
          setCurrency(saved);
          setLoading(false);
          return;
        }

        const res = await fetch('/api/v2/geo');
        const data = await res.json();
        
        if (data.success && data.currency?.code) {
          setCurrency(data.currency.code);
          localStorage.setItem('gostaylo_currency', data.currency.code);
        }
      } catch (e) {
        console.error('[GEO] Detection failed:', e);
      } finally {
        setLoading(false);
      }
    };

    detect();
  }, []);

  return { currency, loading };
}

export default useCurrency;
