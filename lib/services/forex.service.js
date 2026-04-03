/**
 * GoStayLo - Dynamic Forex Engine
 * Real-time currency conversion with hidden 3.5% markup ("GoStayLoRate")
 * 
 * BASE CURRENCY: THB (all DB records in THB)
 * DISPLAY: Converted to user's local currency with markup
 * API: ExchangeRate-API
 */

import { supabaseAdmin } from '@/lib/supabase';
import { getExchangeRateApiKey } from '@/lib/services/currency.service';

function getExchangeApiBaseUrl() {
  const key = getExchangeRateApiKey();
  return key ? `https://v6.exchangerate-api.com/v6/${key}` : null;
}

// GoStayLoRate markup (3.5% hidden margin)
const FUNNYRATE_MARKUP = 1.035;

// Cache duration (1 hour in milliseconds)
const CACHE_DURATION = 60 * 60 * 1000;

// Supported currencies with metadata
export const SUPPORTED_CURRENCIES = {
  THB: { symbol: '฿', name: 'Thai Baht', locale: 'th-TH', flag: '🇹🇭' },
  USD: { symbol: '$', name: 'US Dollar', locale: 'en-US', flag: '🇺🇸' },
  RUB: { symbol: '₽', name: 'Russian Ruble', locale: 'ru-RU', flag: '🇷🇺' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', locale: 'zh-CN', flag: '🇨🇳' },
  EUR: { symbol: '€', name: 'Euro', locale: 'de-DE', flag: '🇪🇺' },
  GBP: { symbol: '£', name: 'British Pound', locale: 'en-GB', flag: '🇬🇧' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', locale: 'en-AU', flag: '🇦🇺' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', locale: 'en-SG', flag: '🇸🇬' },
  JPY: { symbol: '¥', name: 'Japanese Yen', locale: 'ja-JP', flag: '🇯🇵' },
  KRW: { symbol: '₩', name: 'Korean Won', locale: 'ko-KR', flag: '🇰🇷' },
  INR: { symbol: '₹', name: 'Indian Rupee', locale: 'en-IN', flag: '🇮🇳' },
  USDT: { symbol: '$', name: 'Tether', locale: 'en-US', flag: '💰' }
};

// In-memory cache for rates
let ratesCache = {
  rates: null,
  timestamp: 0,
  baseCurrency: 'THB'
};

export class ForexService {
  
  /**
   * Fetch live exchange rates from ExchangeRate-API
   * @param {string} baseCurrency - Base currency (default: THB)
   * @returns {Promise<object>} Rates object
   */
  static async fetchLiveRates(baseCurrency = 'THB') {
    const baseUrl = getExchangeApiBaseUrl();
    if (!baseUrl) {
      console.warn('[FOREX] EXCHANGE_RATE_KEY / EXCHANGE_API_KEY not set; using fallback rates');
      return {
        success: false,
        error: 'Missing exchange rate API key',
        rates: this.getFallbackRates(),
      };
    }
    try {
      const response = await fetch(
        `${baseUrl}/latest/${baseCurrency}`,
        {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10000)
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.result !== 'success') {
        throw new Error(data['error-type'] || 'API returned error');
      }

      console.log('[FOREX] Fetched live rates:', Object.keys(data.conversion_rates).length, 'currencies');
      
      return {
        success: true,
        baseCurrency: data.base_code,
        rates: data.conversion_rates,
        timestamp: data.time_last_update_unix * 1000,
        nextUpdate: data.time_next_update_unix * 1000
      };

    } catch (error) {
      console.error('[FOREX] Fetch error:', error.message);
      return {
        success: false,
        error: error.message,
        rates: this.getFallbackRates()
      };
    }
  }

  /**
   * Get cached rates or fetch new ones
   * @returns {Promise<object>} Rates object
   */
  static async getRates() {
    const now = Date.now();
    
    // Check if cache is valid
    if (ratesCache.rates && (now - ratesCache.timestamp) < CACHE_DURATION) {
      return {
        success: true,
        rates: ratesCache.rates,
        cached: true,
        age: Math.round((now - ratesCache.timestamp) / 1000)
      };
    }

    // Fetch new rates
    const result = await this.fetchLiveRates('THB');
    
    if (result.success) {
      // Update cache
      ratesCache = {
        rates: result.rates,
        timestamp: now,
        baseCurrency: 'THB'
      };
      
      // Store in database for persistence
      await this.storeRatesInDb(result.rates);
    }

    return {
      success: result.success,
      rates: result.rates || this.getFallbackRates(),
      cached: false
    };
  }

  /**
   * Get fallback rates (used when API fails)
   * @returns {object} Fallback rates from THB
   */
  static getFallbackRates() {
    return {
      THB: 1,
      USD: 0.0285,    // ~35 THB = 1 USD
      RUB: 2.55,      // ~35 THB = ~90 RUB
      CNY: 0.205,     // ~35 THB = ~7.2 CNY
      EUR: 0.0265,    // ~35 THB = ~0.93 EUR
      GBP: 0.0225,    // ~35 THB = ~0.79 GBP
      AUD: 0.044,     // ~35 THB = ~1.54 AUD
      SGD: 0.038,     // ~35 THB = ~1.33 SGD
      JPY: 4.3,       // ~35 THB = ~150 JPY
      KRW: 38.5,      // ~35 THB = ~1350 KRW
      INR: 2.38,      // ~35 THB = ~83 INR
      USDT: 0.0285    // Same as USD
    };
  }

  /**
   * Store rates in database for persistence
   * @param {object} rates - Rates object
   */
  static async storeRatesInDb(rates) {
    try {
      for (const [currency, rate] of Object.entries(rates)) {
        if (SUPPORTED_CURRENCIES[currency]) {
          await supabaseAdmin
            .from('exchange_rates')
            .upsert({
              currency_code: currency,
              rate_to_thb: 1 / rate, // Store as THB per unit of foreign currency
              source: 'exchangerate-api',
              updated_at: new Date().toISOString()
            }, { onConflict: 'currency_code' });
        }
      }
      console.log('[FOREX] Stored rates in database');
    } catch (error) {
      console.error('[FOREX DB] Store error:', error.message);
    }
  }

  /**
   * Convert THB to target currency with GoStayLoRate markup
   * @param {number} amountThb - Amount in THB
   * @param {string} targetCurrency - Target currency code
   * @param {boolean} applyMarkup - Apply 3.5% markup (default: true)
   * @returns {Promise<object>} Conversion result
   */
  static async convertFromThb(amountThb, targetCurrency, applyMarkup = true) {
    if (targetCurrency === 'THB') {
      return {
        success: true,
        original: amountThb,
        converted: amountThb,
        currency: 'THB',
        rate: 1,
        funnyRate: 1
      };
    }

    const { rates } = await this.getRates();
    const marketRate = rates[targetCurrency];

    if (!marketRate) {
      return {
        success: false,
        error: `Unsupported currency: ${targetCurrency}`,
        converted: amountThb,
        currency: 'THB'
      };
    }

    // Apply GoStayLoRate markup (user pays 3.5% more)
    const funnyRate = applyMarkup ? marketRate * FUNNYRATE_MARKUP : marketRate;
    const converted = amountThb * funnyRate;

    return {
      success: true,
      original: amountThb,
      converted: Math.round(converted * 100) / 100,
      currency: targetCurrency,
      rate: marketRate,
      funnyRate: funnyRate,
      markup: applyMarkup ? FUNNYRATE_MARKUP : 1
    };
  }

  /**
   * Convert from target currency to THB
   * @param {number} amount - Amount in foreign currency
   * @param {string} sourceCurrency - Source currency code
   * @returns {Promise<object>} Conversion result
   */
  static async convertToThb(amount, sourceCurrency) {
    if (sourceCurrency === 'THB') {
      return {
        success: true,
        original: amount,
        converted: amount,
        currency: 'THB',
        rate: 1
      };
    }

    const { rates } = await this.getRates();
    const marketRate = rates[sourceCurrency];

    if (!marketRate) {
      return {
        success: false,
        error: `Unsupported currency: ${sourceCurrency}`,
        converted: amount
      };
    }

    // Convert to THB (no markup on incoming payments)
    const converted = amount / marketRate;

    return {
      success: true,
      original: amount,
      converted: Math.round(converted * 100) / 100,
      currency: 'THB',
      rate: 1 / marketRate
    };
  }

  /**
   * Format price with currency symbol and locale
   * @param {number} amount - Amount
   * @param {string} currency - Currency code
   * @returns {string} Formatted price
   */
  static formatPrice(amount, currency = 'THB') {
    const config = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.THB;
    
    if (amount == null || isNaN(amount)) {
      return `${config.symbol}0`;
    }

    // Handle large numbers for currencies like JPY, KRW
    const decimals = ['JPY', 'KRW'].includes(currency) ? 0 : 2;
    
    const formatted = new Intl.NumberFormat(config.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: decimals
    }).format(amount);

    return `${config.symbol}${formatted}`;
  }

  /**
   * Get display price in user's currency
   * @param {number} priceThb - Price in THB
   * @param {string} userCurrency - User's preferred currency
   * @returns {Promise<object>} Display price info
   */
  static async getDisplayPrice(priceThb, userCurrency = 'THB') {
    const conversion = await this.convertFromThb(priceThb, userCurrency, true);
    
    return {
      thb: priceThb,
      display: conversion.converted,
      currency: userCurrency,
      formatted: this.formatPrice(conversion.converted, userCurrency),
      formattedThb: this.formatPrice(priceThb, 'THB'),
      ...SUPPORTED_CURRENCIES[userCurrency]
    };
  }

  /**
   * Get all supported currencies with current rates
   * @returns {Promise<object[]>} Currency list with rates
   */
  static async getCurrencyList() {
    const { rates } = await this.getRates();
    
    return Object.entries(SUPPORTED_CURRENCIES).map(([code, info]) => ({
      code,
      ...info,
      rate: rates[code] || 1,
      funnyRate: (rates[code] || 1) * FUNNYRATE_MARKUP,
      sample: this.formatPrice(1000 * (rates[code] || 1), code)
    }));
  }
}

export default ForexService;
