/**
 * CurrencyService — единая точка для курсов и дефолтной комиссии платформы.
 * Курсы UI: Supabase `exchange_rates` (SSOT read) → розничный множитель из `general.chatInvoiceRateMultiplier`.
 * Upstream ExchangeRate-API пишет **только cron** (`/api/cron/exchange-rates-refresh`) — Stage 202.1.
 * Комиссия / USDT для платежей: см. resolveThbPerUsdt, resolveDefaultCommissionPercent. ADR: ARCHITECTURAL_DECISIONS.md.
 */

import { supabaseAdmin } from '@/lib/supabase'
import {
  normalizeThbPerUnitRate,
  isLikelySmokeDefaultRubThbPerUnit,
  isRubUsdCrossRateAnomaly,
} from '@/lib/finance/thb-per-unit-rate.js'
import {
  validateExchangeRateSemantics,
  logExchangeRateValidationFailure,
} from '@/lib/finance/exchange-rates-write-guard.js'
import {
  lastResortThbPerUsdtFromEnv,
  lastResortThbPerUsdtFromGeneralSettings,
  lastResortCommissionPercentFromEnv,
  lastResortChatInvoiceRateMultiplierFromEnv,
  platformDefaultChatInvoiceRateMultiplier,
} from '@/lib/services/currency-last-resort'
import { notifySystemAlert } from '@/lib/services/system-alert-notify.js'
import { guestPayableRoundedThbFromBooking } from '@/lib/booking-price-integrity'
import {
  resolveGuestServiceFeePercentFromGeneral,
  resolveHostCommissionPercentFromGeneral,
} from '@/lib/services/pricing/pricing-fee-policy.js'
import {
  isFxUpstreamInCooldown,
  markFxUpstreamRateLimited,
} from '@/lib/services/fx-upstream-cooldown.js'

export { PLATFORM_SPLIT_FEE_DEFAULTS } from '@/lib/config/platform-split-fee-defaults.js'

/**
 * Курсы из `exchange_rates` считаем валидными для UI без вызова ExchangeRate-API
 * пока возраст строк (по `updated_at`) не превышает этот TTL.
 */
export const EXCHANGE_RATES_DB_TTL_MS = 2 * 60 * 60 * 1000

/** Cron: do not call ExchangeRate-API if every display row is newer than this (4h). */
export const EXCHANGE_RATES_CRON_MIN_INTERVAL_MS = 4 * 60 * 60 * 1000

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
        const v = normalizeThbPerUnitRate(code, parseFloat(row.rate_to_thb))
        if (code && v != null && v > 0) {
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
    map.RUB = normalizeThbPerUnitRate('RUB', envRub) ?? envRub
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
    `[FX_STALE] ⚠️ <b>КРИТИЧНО: Курсы валют устарели!</b>\n` +
    `Последнее обновление: ${escapeHtmlForAdminTg(dateLabel)}\n` +
    `Коды: <code>${escapeHtmlForAdminTg(health.staleCodes.join(', '))}</code>`

  try {
    await notifySystemAlert(text, { severity: 'WARN' })
  } catch (e) {
    console.warn('[CurrencyService] stale FX system alert failed:', e?.message)
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
export const DISPLAY_FX_CODES = ['USD', 'EUR', 'GBP', 'RUB', 'CNY', 'USDT']

/**
 * @returns {Promise<{
 *   ok: boolean,
 *   map: Record<string, number> | null,
 *   httpStatus: number | null,
 *   error: string | null,
 * }>}
 */
export async function fetchDisplayFxFromExchangeRateApiDetailed() {
  const key = getExchangeRateApiKey()
  if (!key) {
    return { ok: false, map: null, httpStatus: null, error: 'NO_API_KEY' }
  }

  if (isFxUpstreamInCooldown()) {
    return {
      ok: false,
      map: null,
      httpStatus: 429,
      error: 'HTTP_429_COOLDOWN',
    }
  }

  try {
    const res = await fetch(`https://v6.exchangerate-api.com/v6/${key}/latest/THB`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      console.warn('[CurrencyService] ExchangeRate-API HTTP', res.status)
      if (res.status === 429) markFxUpstreamRateLimited()
      return { ok: false, map: null, httpStatus: res.status, error: `HTTP_${res.status}` }
    }
    const j = await res.json()
    if (j.result !== 'success' || !j.conversion_rates || typeof j.conversion_rates !== 'object') {
      return { ok: false, map: null, httpStatus: res.status, error: 'INVALID_PAYLOAD' }
    }
    const cr = j.conversion_rates
    const out = {}
    for (const code of DISPLAY_FX_CODES) {
      const perThb = parseFloat(code === 'USDT' ? (cr.USDT ?? cr.USD) : cr[code])
      if (Number.isFinite(perThb) && perThb > 0) {
        out[code] = normalizeThbPerUnitRate(code, 1 / perThb) ?? 1 / perThb
      }
    }
    if (!Object.keys(out).length) {
      return { ok: false, map: null, httpStatus: res.status, error: 'EMPTY_RATES' }
    }
    return { ok: true, map: out, httpStatus: res.status, error: null }
  } catch (e) {
    console.warn('[CurrencyService] ExchangeRate-API (THB base) failed:', e?.message)
    return { ok: false, map: null, httpStatus: null, error: e?.message || 'FETCH_FAILED' }
  }
}

/**
 * ExchangeRate-API v6: base THB → conversion_rates[XXX] = сколько XXX за 1 THB.
 * THB за 1 XXX = 1 / conversion_rates[XXX].
 * @returns {Record<string, number> | null}
 */
async function fetchThbPerUnitFromExchangeRateApi() {
  const r = await fetchDisplayFxFromExchangeRateApiDetailed()
  return r.ok ? r.map : null
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
 * Stage 127.0 — SSOT expected USDT (crypto webhook, verify-tron, production guard).
 * THB: `pricing_snapshot` v2 → `guestPayableRoundedThbFromBooking`.
 * FX: locked `metadata.usdt_rate_thb` (AUDIT_03 W3.11) → else live `resolveThbPerUsdt`.
 * @param {object} booking
 * @param {{ intent?: object | null }} [opts]
 * @returns {Promise<number | null>}
 */
export async function getExpectedUsdtForBooking(booking, opts = {}) {
  const totalThb = guestPayableRoundedThbFromBooking(booking)
  if (!Number.isFinite(totalThb) || totalThb <= 0) return null
  const { readLockedUsdtRateThb } = await import('@/lib/payment/crypto-usdt-rate-lock.js')
  const locked = readLockedUsdtRateThb(booking, opts.intent || null)
  const rate = Number.isFinite(locked) && locked > 0 ? locked : await resolveThbPerUsdt()
  if (!Number.isFinite(rate) || rate <= 0) return null
  return Math.round((totalThb / rate) * 100) / 100
}

/**
 * Глобальный процент комиссии **с партнёра** (host commission): system_settings → env.
 * Legacy alias: `defaultCommissionRate` (зеркало `hostCommissionPercent`).
 * @returns {Promise<number>}
 */
export async function resolveDefaultCommissionPercent() {
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle()
    const general = data?.value && typeof data.value === 'object' ? data.value : {}
    return resolveHostCommissionPercentFromGeneral(general)
  }

  const fromEnv = lastResortCommissionPercentFromEnv()
  if (fromEnv != null) return fromEnv

  const msg =
    '[CurrencyService] Host commission missing: set system_settings.general.hostCommissionPercent or DEFAULT_COMMISSION_PERCENT env'
  console.error(msg)
  throw new Error(msg)
}

/**
 * Глобальный guest service fee % (сбор с гостя, не host commission).
 * @returns {Promise<number>}
 */
export async function resolveGuestServiceFeePercent() {
  if (supabaseAdmin) {
    const { data } = await supabaseAdmin.from('system_settings').select('value').eq('key', 'general').maybeSingle()
    const general = data?.value && typeof data.value === 'object' ? data.value : {}
    return resolveGuestServiceFeePercentFromGeneral(general)
  }
  return PLATFORM_SPLIT_FEE_DEFAULTS.guestServiceFeePercent
}

/**
 * Множитель «розничного» курса: `system_settings.general.chatInvoiceRateMultiplier` → `CHAT_INVOICE_RATE_MULTIPLIER` → дефолт платформы.
 * Используется: (1) после сборки {@link getDisplayRateMap} — витрина и бронь в валюте гостя; (2) {@link getEffectiveRate} для чат-счетов THB↔USDT.
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
 * RUB: smoke/e2e писали 1/2.8 в rate_to_thb — валидно для CHECK, но завышает цены ~27%.
 * Форсируем ExchangeRate-API, даже если updated_at «свежий».
 * @param {Record<string, number>} map
 * @param {Record<string, string>} [sourceByCode]
 */
function rubDisplayRateNeedsApiRefresh(map, sourceByCode = {}) {
  const rub = map.RUB
  if (rub == null || !Number.isFinite(rub) || rub <= 0) return true
  const src = String(sourceByCode.RUB || '').toLowerCase()
  if (src.includes('smoke')) return true
  if (isLikelySmokeDefaultRubThbPerUnit(rub)) return true
  const usd = map.USD
  if (usd != null && isRubUsdCrossRateAnomaly(usd, rub)) return true
  return false
}

/**
 * Нужен ли вызов ExchangeRate-API: нет ключа, нет строки, нет `updated_at`, либо любая
 * из display-валют старше {@link EXCHANGE_RATES_DB_TTL_MS}; RUB — см. {@link rubDisplayRateNeedsApiRefresh}.
 */
function displayRatesNeedApiRefresh(map, updatedAtByCode, sourceByCode = {}) {
  if (!getExchangeRateApiKey()) return false
  if (rubDisplayRateNeedsApiRefresh(map, sourceByCode)) return true
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
export async function upsertDisplayRatesInDb(apiMap) {
  if (!supabaseAdmin || !apiMap) return
  const now = new Date().toISOString()
  const rows = []
  for (const c of DISPLAY_FX_CODES) {
    const raw = apiMap[c]
    if (raw == null || !Number.isFinite(raw) || raw <= 0) continue
    const check = validateExchangeRateSemantics(c, raw)
    if (!check.ok) {
      logExchangeRateValidationFailure(c, raw, 'CurrencyService.upsertDisplayRatesInDb')
      continue
    }
    rows.push({
      currency_code: c,
      rate_to_thb: check.normalizedRate,
      source: 'exchangerate-api',
      updated_at: now,
    })
  }
  if (!rows.length) return
  const { error } = await supabaseAdmin.from('exchange_rates').upsert(rows, { onConflict: 'currency_code' })
  if (error) {
    console.warn('[CurrencyService] exchange_rates upsert failed:', error.message)
  }
}

/**
 * После «сырых» mid-market курсов: уменьшаем `rate_to_thb` для всех валют кроме THB.
 * В `formatPrice` сумма в валюте = THB / rate → гость видит **больше** USD/RUB/… за тот же THB (розничный спред).
 * @param {Record<string, number>} map
 * @param {number} multiplier — ≥1, из {@link resolveChatInvoiceRateMultiplier}
 */
function applyRetailMarkupToDisplayMap(map, multiplier) {
  const m = Number(multiplier)
  if (!Number.isFinite(m) || m <= 1) return
  for (const code of Object.keys(map)) {
    if (code === 'THB') continue
    const v = map[code]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      map[code] = v / m
    }
  }
}

/**
 * Карта rate_to_thb (THB за 1 единицу валюты) для UI, SEO-метаданных и GET /api/v2/exchange-rates.
 *
 * 1) Читаем **все** строки `exchange_rates` (+ `updated_at`).
 * 2) Env `FALLBACK_RATE_USD_TO_THB` / `FALLBACK_RATE_RUB_TO_THB` только если в карте нет USD/RUB.
 * 3) **Stage 202.1:** внешний ExchangeRate-API на этом пути **не** вызываем (даже если строки старше
 *    {@link EXCHANGE_RATES_DB_TTL_MS}). Иначе каждый page load / serverless isolate жжёт free-tier квоту
 *    и спамит TG. Upstream пишет только cron → {@link upsertDisplayRatesInDb}.
 *    Opt-in: `{ allowUpstreamRefresh: true }` (admin/tools only; not used by storefront).
 * 4) Если API недоступен / cron не обновил — отдаём (возможно устаревшие) данные БД + env.
 * 5) USDT fallback: `resolveThbPerUsdt()`; USD из USDT при пустом USD.
 * 6) **Розничная надбавка:** на возвращаемую карту применяется {@link resolveChatInvoiceRateMultiplier} …
 *    Проверка устаревания (`maybeAlertStaleDisplayRates`) — по **сырым** курсам до надбавки.
 *
 * @param {{ applyRetailMarkup?: boolean, allowUpstreamRefresh?: boolean }} [options]
 */
export async function getDisplayRateMap(options = {}) {
  const map = { THB: 1 }
  /** @type {Record<string, string>} */
  const updatedAtByCode = {}
  /** @type {Record<string, string>} */
  const sourceByCode = {}

  if (supabaseAdmin) {
    const { data } = await supabaseAdmin
      .from('exchange_rates')
      .select('currency_code, rate_to_thb, updated_at, source')
    if (data?.length) {
      for (const row of data) {
        const code = row.currency_code
        const v = normalizeThbPerUnitRate(code, parseFloat(row.rate_to_thb))
        if (code && v != null && v > 0) {
          map[code] = v
          if (row.updated_at) updatedAtByCode[code] = row.updated_at
          if (row.source) sourceByCode[code] = String(row.source)
        }
      }
    }
  }

  const envUsd = parseEnvPositiveFloat('FALLBACK_RATE_USD_TO_THB')
  const envRub = parseEnvPositiveFloat('FALLBACK_RATE_RUB_TO_THB')
  if (!map.USD && envUsd) map.USD = envUsd
  if (!map.RUB && envRub) map.RUB = normalizeThbPerUnitRate('RUB', envRub) ?? envRub

  // Hot path must not hammer ExchangeRate-API (Stage 202.1). Cron is the writer SSOT.
  if (
    options.allowUpstreamRefresh === true &&
    displayRatesNeedApiRefresh(map, updatedAtByCode, sourceByCode)
  ) {
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

  if (options?.applyRetailMarkup !== false) {
    const retailMult = await resolveChatInvoiceRateMultiplier()
    applyRetailMarkupToDisplayMap(map, retailMult)
  }

  return map
}

function normalizeCurrencyCode(c) {
  return String(c || '').toUpperCase().trim()
}

/**
 * Эффективный множитель для счетов в чате: сумма в base × rate → target (после {@link resolveChatInvoiceRateMultiplier}).
 * Поддерживаются пары THB↔USDT.
 */
/**
 * Конвертация суммы из THB в другую валюту по карте **THB за 1 единицу** (`rate_to_thb`).
 * @param {number} amountThb
 * @param {string} currencyCode — THB | USD | RUB | …
 * @param {Record<string, number>} thbPerUnitMap — например из {@link getDisplayRateMap}
 * @returns {number|null}
 */
export function convertAmountThbToCurrency(amountThb, currencyCode, thbPerUnitMap) {
  const thb = Number(amountThb)
  if (!Number.isFinite(thb)) return null
  const code = String(currencyCode || 'THB').toUpperCase().trim()
  if (code === 'THB') return thb
  const rate = thbPerUnitMap?.[code]
  if (!Number.isFinite(rate) || rate <= 0) return null
  return thb / rate
}

/**
 * @deprecated Prefer storefront retail settle (`settleInvoiceDisplayAmount` / `getStorefrontDisplayRateMap`).
 * Unused in product paths; multiplies USDT↔THB by chat markup (conflicts with retail divide model).
 * Kept for CurrencyService API compatibility — do not wire new call sites.
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
  static EXCHANGE_RATES_CRON_MIN_INTERVAL_MS = EXCHANGE_RATES_CRON_MIN_INTERVAL_MS
  static DISPLAY_FX_STALE_ALERT_MS = DISPLAY_FX_STALE_ALERT_MS
  static evaluateDisplayFxStale = evaluateDisplayFxStale
  static getDisplayFxStaleHealthFromDb = getDisplayFxStaleHealthFromDb
}

export default CurrencyService
