/**
 * CurrencyService — единая точка для курсов и дефолтной комиссии платформы.
 * Курсы UI: Supabase `exchange_rates` (TTL 6 ч) → при устаревании ExchangeRate-API + upsert в БД.
 * Комиссия / USDT для платежей: см. resolveThbPerUsdt, resolveDefaultCommissionPercent. ADR: ARCHITECTURAL_DECISIONS.md.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  lastResortThbPerUsdtFromEnv,
  lastResortThbPerUsdtFromGeneralSettings,
  lastResortCommissionPercentFromEnv,
  lastResortChatInvoiceRateMultiplierFromEnv,
  platformDefaultChatInvoiceRateMultiplier,
} from '@/lib/services/currency-last-resort'

/**
 * Курсы из `exchange_rates` считаем валидными для UI без вызова ExchangeRate-API
 * пока возраст строк (по `updated_at`) не превышает этот TTL.
 */
export const EXCHANGE_RATES_DB_TTL_MS = 6 * 60 * 60 * 1000

/** Порог для Admin Health / Telegram: дисплей-валюты старше этого возраста — критично. */
export const DISPLAY_FX_STALE_ALERT_MS = 24 * 60 * 60 * 1000

let lastDisplayFxStaleAlertAt = 0
const DISPLAY_FX_STALE_ALERT_COOLDOWN_MS = 60 * 60 * 1000

/**
 * Проверка «живости» дисплей-курсов по `updated_at` (после сборки карты).
 * @param {Record<string, string>} updatedAtByCode ISO из БД / API
 * @param {Record<string, number>} map итоговая карта rate_to_thb
 */
export function evaluateDisplayFxStale(updatedAtByCode, map) {
  const staleCodes = []
  let oldestTs = Infinity
  let oldestIso = null
  const now = Date.now()

  for (const code of DISPLAY_FX_CODES) {
    const r = map[code]
    if (r == null || !Number.isFinite(r) || r <= 0) {
      staleCodes.push(code)
      continue
    }
    const tsStr = updatedAtByCode[code]
    if (!tsStr) {
      staleCodes.push(code)
      continue
    }
    const ts = new Date(tsStr).getTime()
    if (Number.isNaN(ts)) {
      staleCodes.push(code)
      continue
    }
    if (now - ts > DISPLAY_FX_STALE_ALERT_MS) {
      staleCodes.push(code)
      if (ts < oldestTs) {
        oldestTs = ts
        oldestIso = tsStr
      }
    }
  }

  return {
    stale: staleCodes.length > 0,
    staleCodes,
    /** Самая ранняя `updated_at` среди устаревших (если есть) */
    oldestStaleIso: oldestIso,
  }
}

/**
 * Снимок устаревания по данным БД (без вызова внешнего FX API) — для админ-дашборда.
 */
export async function getDisplayFxStaleHealthFromDb() {
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
  if (!map.USD && envUsd) {
    map.USD = envUsd
  }
  if (!map.RUB && envRub) {
    map.RUB = envRub
  }

  const health = evaluateDisplayFxStale(updatedAtByCode, map)
  let lastUpdateLabel = null
  if (health.oldestStaleIso) {
    try {
      lastUpdateLabel = new Date(health.oldestStaleIso).toLocaleString('ru-RU', {
        timeZone: 'Asia/Bangkok',
      })
    } catch {
      lastUpdateLabel = health.oldestStaleIso
    }
  }
  return {
    ...health,
    lastUpdateLabel,
  }
}

async function maybeAlertStaleDisplayRates(updatedAtByCode, map) {
  const health = evaluateDisplayFxStale(updatedAtByCode, map)
  if (!health.stale) return

  console.warn(
    `[CurrencyService] Display FX stale (>24h or missing ts): ${health.staleCodes.join(', ')}`,
  )

  const now = Date.now()
  if (now - lastDisplayFxStaleAlertAt < DISPLAY_FX_STALE_ALERT_COOLDOWN_MS) {
    return
  }
  lastDisplayFxStaleAlertAt = now

  const dateLabel = health.oldestStaleIso
    ? new Date(health.oldestStaleIso).toLocaleString('ru-RU', { timeZone: 'Asia/Bangkok' })
    : 'неизвестно'

  const text =
    `⚠️ <b>КРИТИЧНО: Курсы валют устарели!</b>\n` +
    `Последнее обновление: ${escapeHtmlForAdminTg(dateLabel)}\n` +
    `Коды: <code>${escapeHtmlForAdminTg(health.staleCodes.join(', '))}</code>`

  try {
    const { NotificationService } = await import('@/lib/services/notification.service.js')
    await NotificationService.sendToAdmin(text)
  } catch (e) {
    console.warn('[CurrencyService] stale FX admin notify failed:', e?.message)
  }
}

function escapeHtmlForAdminTg(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

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

  const fromEnv = lastResortThbPerUsdtFromEnv()
  if (fromEnv != null) return fromEnv

  const fromGeneral = await lastResortThbPerUsdtFromGeneralSettings(supabaseAdmin)
  if (fromGeneral != null) return fromGeneral

  const msg =
    '[CurrencyService] THB/USDT rate missing: set exchange_rates.USDT, FALLBACK_THB_PER_USDT env, or system_settings.general.fallbackThbPerUsdt'
  console.error(msg)
  throw new Error(msg)
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

  const fromEnv = lastResortCommissionPercentFromEnv()
  if (fromEnv != null) return fromEnv

  const msg =
    '[CurrencyService] Default commission missing: set system_settings.general.defaultCommissionRate or DEFAULT_COMMISSION_PERCENT env'
  console.error(msg)
  throw new Error(msg)
}

/**
 * Множитель к курсу THB↔USDT для счетов в чате: `system_settings.general.chatInvoiceRateMultiplier` → `CHAT_INVOICE_RATE_MULTIPLIER` → дефолт платформы.
 * @returns {Promise<number>}
 */
export async function resolveChatInvoiceRateMultiplier() {
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle()
    const raw = data?.value?.chatInvoiceRateMultiplier
    if (raw != null && raw !== '') {
      const n = parseFloat(raw)
      if (Number.isFinite(n) && n >= 1 && n <= 1.5) return n
    }
  }

  const fromEnv = lastResortChatInvoiceRateMultiplierFromEnv()
  if (fromEnv != null) return fromEnv

  return platformDefaultChatInvoiceRateMultiplier()
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
    map.USDT = await resolveThbPerUsdt()
  }
  if (!map.USD && map.USDT) map.USD = map.USDT

  if (map.USDT && !updatedAtByCode.USDT && supabaseAdmin) {
    const { data: usdtRow } = await supabaseAdmin
      .from('exchange_rates')
      .select('updated_at')
      .eq('currency_code', 'USDT')
      .maybeSingle()
    if (usdtRow?.updated_at) {
      updatedAtByCode.USDT = usdtRow.updated_at
    }
  }

  await maybeAlertStaleDisplayRates(updatedAtByCode, map)

  return map
}

function normalizeCurrencyCode(c) {
  return String(c || '').toUpperCase().trim()
}

/**
 * Эффективный множитель для счетов в чате: сумма в base × rate → target (после {@link resolveChatInvoiceRateMultiplier}).
 * Поддерживаются пары THB↔USDT.
 */
export async function getEffectiveRate(baseCurrency, targetCurrency) {
  const base = normalizeCurrencyCode(baseCurrency)
  const target = normalizeCurrencyCode(targetCurrency)

  if (base === target) return 1

  const thbPerUsdt = await resolveThbPerUsdt()
  const chatMult = await resolveChatInvoiceRateMultiplier()

  if (base === 'THB' && target === 'USDT') {
    return (1 / thbPerUsdt) * chatMult
  }
  if (base === 'USDT' && target === 'THB') {
    return thbPerUsdt * chatMult
  }

  throw new Error(`Unsupported currency pair for chat invoice: ${base} → ${target}`)
}

export class CurrencyService {
  static getExchangeRateApiKey = getExchangeRateApiKey
  static parseEnvPositiveFloat = parseEnvPositiveFloat
  static resolveThbPerUsdt = resolveThbPerUsdt
  static resolveDefaultCommissionPercent = resolveDefaultCommissionPercent
  static getDisplayRateMap = getDisplayRateMap
  static getEffectiveRate = getEffectiveRate
  static resolveChatInvoiceRateMultiplier = resolveChatInvoiceRateMultiplier
  static EXCHANGE_RATES_DB_TTL_MS = EXCHANGE_RATES_DB_TTL_MS
  static DISPLAY_FX_STALE_ALERT_MS = DISPLAY_FX_STALE_ALERT_MS
  static evaluateDisplayFxStale = evaluateDisplayFxStale
  static getDisplayFxStaleHealthFromDb = getDisplayFxStaleHealthFromDb
}

export default CurrencyService
