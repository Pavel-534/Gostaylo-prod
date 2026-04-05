/**
 * CurrencyService — единая точка для курсов и дефолтной комиссии платформы.
 * Курсы UI: Supabase `exchange_rates` (TTL 6 ч) → при устаревании ExchangeRate-API + upsert в БД.
 * Комиссия / USDT для платежей: см. resolveThbPerUsdt, resolveDefaultCommissionPercent. ADR: ARCHITECTURAL_DECISIONS.md.
 */

import { supabaseAdmin } from '@/lib/supabase'

/**
 * Курсы из `exchange_rates` считаем валидными для UI без вызова ExchangeRate-API
 * пока возраст строк (по `updated_at`) не превышает этот TTL.
 */
export const EXCHANGE_RATES_DB_TTL_MS = 6 * 60 * 60 * 1000

/** Аварийный fallback только если не заданы ни БД, ни env (задайте FALLBACK_THB_PER_USDT / DEFAULT_COMMISSION_PERCENT в prod). */
const EMERGENCY_FALLBACK_THB_PER_USDT = 35.5
const EMERGENCY_DEFAULT_COMMISSION_PERCENT = 15

export function getExchangeRateApiKey() {
  return (process.env.EXCHANGE_RATE_KEY || process.env.EXCHANGE_API_KEY || '').trim()
}

/** Валюты из селектора в шапке + USDT; для каждой нужен rate_to_thb (THB за 1 единицу) в rateMap. */
const DISPLAY_FX_CODES = ['USD', 'EUR', 'GBP', 'RUB', 'CNY', 'USDT']

/**
 * ExchangeRate-API v6: base THB → conversion_rates[XXX] = сколько XXX за 1 THB.
 * THB за 1 XXX = 1 / conversion_rates[XXX].
 * @returns {Record<string, number> | null}
 */
async function fetchThbPerUnitFromExchangeRateApi() {
  const key = getExchangeRateApiKey()
  if (!key) return null

  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${key}/latest/THB`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(String(res.status))
    const j = await res.json()
    if (j.result !== 'success' || !j.conversion_rates || typeof j.conversion_rates !== 'object') {
      return null
    }
    const cr = j.conversion_rates
    const out = {}
    for (const code of DISPLAY_FX_CODES) {
      const perThb = parseFloat(code === 'USDT' ? (cr.USDT ?? cr.USD) : cr[code])
      if (Number.isFinite(perThb) && perThb > 0) {
        out[code] = 1 / perThb
      }
    }
    return Object.keys(out).length ? out : null
  } catch (e) {
    console.warn('[CurrencyService] ExchangeRate-API (THB base) failed:', e?.message)
    return null
  }
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
      if (Number.isFinite(r) && r > 0 && !Number.isNaN(updatedAt) && Date.now() - updatedAt <= EXCHANGE_RATES_DB_TTL_MS) {
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
 * Нужен ли вызов ExchangeRate-API: нет ключа, нет строки, нет `updated_at`, либо любая
 * из display-валют старше {@link EXCHANGE_RATES_DB_TTL_MS}.
 */
function displayRatesNeedApiRefresh(map, updatedAtByCode) {
  if (!getExchangeRateApiKey()) return false
  const now = Date.now()
  for (const code of DISPLAY_FX_CODES) {
    const r = map[code]
    if (r == null || !Number.isFinite(r) || r <= 0) return true
    const ts = updatedAtByCode[code]
    if (!ts) return true
    const age = now - new Date(ts).getTime()
    if (age > EXCHANGE_RATES_DB_TTL_MS) return true
  }
  return false
}

/**
 * Записать свежие курсы в Supabase (один батч — один «возраст» для всех display-валют).
 */
async function upsertDisplayRatesInDb(apiMap) {
  if (!supabaseAdmin || !apiMap) return
  const now = new Date().toISOString()
  const rows = DISPLAY_FX_CODES.filter((c) => apiMap[c] != null && Number.isFinite(apiMap[c]) && apiMap[c] > 0).map(
    (c) => ({
      currency_code: c,
      rate_to_thb: apiMap[c],
      source: 'exchangerate-api',
      updated_at: now,
    }),
  )
  if (!rows.length) return
  const { error } = await supabaseAdmin.from('exchange_rates').upsert(rows, { onConflict: 'currency_code' })
  if (error) {
    console.warn('[CurrencyService] exchange_rates upsert failed:', error.message)
  }
}

/**
 * Карта rate_to_thb (THB за 1 единицу валюты) для UI и GET /api/v2/exchange-rates.
 *
 * 1) Читаем **все** строки `exchange_rates` (+ `updated_at`).
 * 2) Env `FALLBACK_RATE_USD_TO_THB` / `FALLBACK_RATE_RUB_TO_THB` только если в карте нет USD/RUB.
 * 3) Без `EXCHANGE_RATE_KEY` внешний API не вызываем. Иначе — только если не хватает курса
 *    или `updated_at` по любой из display-валют (USD, EUR, GBP, RUB, CNY, USDT) старше {@link EXCHANGE_RATES_DB_TTL_MS}.
 * 4) После успешного ответа API — **upsert** в `exchange_rates`, чтобы следующие запросы шли из БД.
 * 5) Если API недоступен — остаёмся на (возможно устаревших) данных БД + env.
 * 6) USDT fallback: `resolveThbPerUsdt()`; USD из USDT при пустом USD.
 */
export async function getDisplayRateMap() {
  const map = { THB: 1 }
  /** @type {Record<string, string>} */
  const updatedAtByCode = {}

  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('exchange_rates')
      .select('currency_code, rate_to_thb, updated_at')
    if (data?.length) {
      for (const row of data) {
        const code = row.currency_code
        const v = parseFloat(row.rate_to_thb)
        if (code && Number.isFinite(v) && v > 0) {
          map[code] = v
          if (row.updated_at) updatedAtByCode[code] = row.updated_at
        }
      }
    }
  }

  const envUsd = parseEnvPositiveFloat('FALLBACK_RATE_USD_TO_THB')
  const envRub = parseEnvPositiveFloat('FALLBACK_RATE_RUB_TO_THB')
  if (!map.USD && envUsd) map.USD = envUsd
  if (!map.RUB && envRub) map.RUB = envRub

  if (displayRatesNeedApiRefresh(map, updatedAtByCode)) {
    const apiMap = await fetchThbPerUnitFromExchangeRateApi()
    if (apiMap) {
      await upsertDisplayRatesInDb(apiMap)
      const nowIso = new Date().toISOString()
      for (const code of DISPLAY_FX_CODES) {
        if (apiMap[code] != null) {
          map[code] = apiMap[code]
          updatedAtByCode[code] = nowIso
        }
      }
    }
  }

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
  static EXCHANGE_RATES_DB_TTL_MS = EXCHANGE_RATES_DB_TTL_MS
}

export default CurrencyService
