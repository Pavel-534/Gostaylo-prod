/**
 * CurrencyService — единая точка для курсов и дефолтной комиссии платформы.
 * Порядок: БД (exchange_rates / system_settings) → внешний API (EXCHANGE_RATE_KEY) → env → аварийные константы только здесь (см. ARCHITECTURAL_DECISIONS.md).
 */

import { supabaseAdmin } from '@/lib/supabase'

const STALE_MS = 24 * 60 * 60 * 1000

/** Аварийный fallback только если не заданы ни БД, ни env (задайте FALLBACK_THB_PER_USDT / DEFAULT_COMMISSION_PERCENT в prod). */
const EMERGENCY_FALLBACK_THB_PER_USDT = 35.5
const EMERGENCY_DEFAULT_COMMISSION_PERCENT = 15

export function getExchangeRateApiKey() {
  return (process.env.EXCHANGE_RATE_KEY || process.env.EXCHANGE_API_KEY || '').trim()
}

/**
 * @param {string} name env var
 * @returns {number|null}
 */
export function parseEnvPositiveFloat(name) {
  const v = process.env[name]
  if (v == null || v === '') return null
  const n = parseFloat(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * THB за 1 USDT (как в колонке exchange_rates.rate_to_thb для USDT).
 */
export async function resolveThbPerUsdt() {
  if (supabaseAdmin) {
    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('rate_to_thb, updated_at')
      .eq('currency_code', 'USDT')
      .maybeSingle()

    if (!error && data) {
      const r = parseFloat(data.rate_to_thb)
      const updatedAt = data.updated_at ? new Date(data.updated_at).getTime() : NaN
      if (Number.isFinite(r) && r > 0 && !Number.isNaN(updatedAt) && Date.now() - updatedAt <= STALE_MS) {
        return r
      }
    }
  }

  const key = getExchangeRateApiKey()
  if (key) {
    try {
      const res = await fetch(`https://v6.exchangerate-api.com/v6/${key}/latest/THB`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(String(res.status))
      const j = await res.json()
      if (j.result === 'success' && j.conversion_rates && typeof j.conversion_rates === 'object') {
        const usdtPerThb = j.conversion_rates.USDT ?? j.conversion_rates.USD
        const v = parseFloat(usdtPerThb)
        if (Number.isFinite(v) && v > 0) return 1 / v
      }
    } catch (e) {
      console.warn('[CurrencyService] FX API failed:', e?.message)
    }
  }

  const fromEnv = parseEnvPositiveFloat('FALLBACK_THB_PER_USDT')
  if (fromEnv != null) return fromEnv

  console.warn('[CurrencyService] Using emergency THB/USDT fallback; set FALLBACK_THB_PER_USDT or exchange_rates.USDT')
  return EMERGENCY_FALLBACK_THB_PER_USDT
}

/**
 * Глобальный процент комиссии платформы (не персональный партнёрский): system_settings → env.
 * @returns {Promise<number>}
 */
export async function resolveDefaultCommissionPercent() {
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle()
    const raw = data?.value?.defaultCommissionRate
    if (raw != null && raw !== '') {
      const n = parseFloat(raw)
      if (Number.isFinite(n) && n >= 0 && n <= 100) return n
    }
  }

  const fromEnv = parseEnvPositiveFloat('DEFAULT_COMMISSION_PERCENT')
  if (fromEnv != null && fromEnv <= 100) return fromEnv

  console.warn('[CurrencyService] Using emergency default commission; set DEFAULT_COMMISSION_PERCENT or system_settings.general')
  return EMERGENCY_DEFAULT_COMMISSION_PERCENT
}

/**
 * Карта rate_to_thb по коду валюты для UI/SSR. Пробелы добиваются из env FALLBACK_RATE_*.
 */
export async function getDisplayRateMap() {
  const map = { THB: 1 }

  if (supabaseAdmin) {
    const { data } = await supabaseAdmin.from('exchange_rates').select('currency_code, rate_to_thb')
    if (data?.length) {
      for (const row of data) {
        const code = row.currency_code
        const v = parseFloat(row.rate_to_thb)
        if (code && Number.isFinite(v) && v > 0) map[code] = v
      }
    }
  }

  const envUsd = parseEnvPositiveFloat('FALLBACK_RATE_USD_TO_THB')
  const envRub = parseEnvPositiveFloat('FALLBACK_RATE_RUB_TO_THB')
  if (!map.USD && envUsd) map.USD = envUsd
  if (!map.RUB && envRub) map.RUB = envRub

  if (!map.USDT) {
    try {
      map.USDT = await resolveThbPerUsdt()
    } catch {
      map.USDT = parseEnvPositiveFloat('FALLBACK_THB_PER_USDT') ?? EMERGENCY_FALLBACK_THB_PER_USDT
    }
  }
  if (!map.USD && map.USDT) map.USD = map.USDT

  return map
}

export class CurrencyService {
  static getExchangeRateApiKey = getExchangeRateApiKey
  static parseEnvPositiveFloat = parseEnvPositiveFloat
  static resolveThbPerUsdt = resolveThbPerUsdt
  static resolveDefaultCommissionPercent = resolveDefaultCommissionPercent
  static getDisplayRateMap = getDisplayRateMap
}

export default CurrencyService
