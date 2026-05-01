/**
 * Schema-probe для определения, доступны ли новые geo-колонки (Global Pivot migration).
 *
 * Проблема: `applySmartWhereFilter` строит PostgREST OR-клаузу с предикатами
 * `country_code.eq...`. Если колонки ещё не существуют в БД (миграция не применена),
 * PostgREST/Postgres возвращают 500 SQLSTATE 42703 — НЕ silent degrade.
 *
 * Решение: один раз пробуем SELECT id FROM listings с filter country_code.eq.X,
 * кешируем результат на N минут. Дальше applySmartWhereFilter использует флаг.
 *
 * Идемпотентно безопасно: после применения миграции probe вернёт true автоматически
 * (по истечении кеша). Можно сбросить вызовом invalidateGeoSchemaCache().
 *
 * @created 2026-02 Global DB Sprint
 */

import { supabaseAdmin } from '@/lib/supabase'

const PROBE_TTL_MS = 5 * 60 * 1000 // 5 минут

let cache = {
  hasCountryCode: null,
  hasRegionCode: null,
  hasCityCode: null,
  ts: 0,
}

let inflightPromise = null

async function probeColumn(col) {
  try {
    // Минимальный запрос: select только проверяемой колонки + limit 1.
    // Если колонка отсутствует — Supabase PostgREST вернёт error.code === '42703'.
    const { error } = await supabaseAdmin
      .from('listings')
      .select(col)
      .limit(1)
    if (error) {
      const code = error.code || ''
      const msg = error.message || ''
      if (code === '42703' || /column.*does not exist/i.test(msg)) {
        return false
      }
      // Любая другая ошибка — возвращаем false (защитный fallback)
      return false
    }
    return true
  } catch {
    return false
  }
}

async function refreshProbe() {
  const [hasCountry, hasRegion, hasCity] = await Promise.all([
    probeColumn('country_code'),
    probeColumn('region_code'),
    probeColumn('city_code'),
  ])
  cache = {
    hasCountryCode: hasCountry,
    hasRegionCode: hasRegion,
    hasCityCode: hasCity,
    ts: Date.now(),
  }
  return cache
}

/**
 * @returns {Promise<{ hasCountryCode: boolean, hasRegionCode: boolean, hasCityCode: boolean }>}
 */
export async function getGeoSchemaState() {
  const now = Date.now()
  if (cache.hasCountryCode !== null && now - cache.ts < PROBE_TTL_MS) {
    return cache
  }
  if (inflightPromise) return inflightPromise
  inflightPromise = refreshProbe().finally(() => { inflightPromise = null })
  return inflightPromise
}

export function invalidateGeoSchemaCache() {
  cache = { hasCountryCode: null, hasRegionCode: null, hasCityCode: null, ts: 0 }
}
