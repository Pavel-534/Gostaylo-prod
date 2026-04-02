import { supabaseAdmin } from '@/lib/supabase'
import { estimateOpenAiCostUsd } from '@/lib/ai/openai-cost'

export const TASK_LISTING_DESCRIPTION = 'listing_description'
/** Парсинг подписи к фото в Telegram (Ленивый Риелтор) */
export const TASK_TELEGRAM_PARSER = 'telegram_parser'
/** Векторный индекс объявления (text-embedding-3-small) */
export const TASK_EMBEDDING = 'embedding'

const QUOTA_PER_LISTING = 3

/**
 * Границы периода для админ-дашборда (UTC).
 * @param {'today'|'7d'|'month'|'all'} period
 * @returns {{ startIso: string|null, endIso: string|null }}
 */
export function aiUsagePeriodBounds(period, now = new Date()) {
  const endIso = now.toISOString()
  if (period === 'all') return { startIso: null, endIso: null }
  if (period === 'today') {
    const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
    return { startIso: s.toISOString(), endIso: null }
  }
  if (period === '7d') {
    const s = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { startIso: s.toISOString(), endIso: null }
  }
  if (period === 'month') {
    const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
    return { startIso: s.toISOString(), endIso: null }
  }
  const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
  return { startIso: s.toISOString(), endIso: null }
}

/**
 * Суммы по каналам + последние записи (постраничная выборка, cap 50k строк на агрегацию).
 * @param {'today'|'7d'|'month'|'all'} period
 */
export async function getAiUsageDashboardData(period, opts = {}) {
  if (!supabaseAdmin) {
    return {
      totalUsd: 0,
      telegramUsd: 0,
      webUsd: 0,
      embeddingUsd: 0,
      requestCount: 0,
      recent: [],
      error: 'no_admin_client',
    }
  }
  const { startIso, endIso } = aiUsagePeriodBounds(period, opts.now || new Date())
  const pageSize = 1000
  const maxRows = 50_000
  let offset = 0
  let totalUsd = 0
  let telegramUsd = 0
  let webUsd = 0
  let embeddingUsd = 0
  let requestCount = 0
  let aggError = null

  for (;;) {
    let q = supabaseAdmin
      .from('ai_usage_logs')
      .select('task_type, cost_usd')
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1)
    if (startIso) q = q.gte('created_at', startIso)
    if (endIso) q = q.lte('created_at', endIso)
    const { data, error } = await q
    if (error) {
      aggError = error.message
      break
    }
    const chunk = data || []
    for (const r of chunk) {
      requestCount += 1
      const v = parseFloat(r.cost_usd)
      if (!Number.isFinite(v)) continue
      totalUsd += v
      const tt = String(r.task_type || '')
      if (tt === TASK_TELEGRAM_PARSER) telegramUsd += v
      else if (tt === TASK_LISTING_DESCRIPTION) webUsd += v
      else if (tt === TASK_EMBEDDING) embeddingUsd += v
    }
    if (chunk.length < pageSize) break
    offset += pageSize
    if (offset >= maxRows) break
  }

  let recentQuery = supabaseAdmin
    .from('ai_usage_logs')
    .select('id, created_at, task_type, cost_usd, model')
    .order('created_at', { ascending: false })
    .limit(20)
  if (startIso) recentQuery = recentQuery.gte('created_at', startIso)
  if (endIso) recentQuery = recentQuery.lte('created_at', endIso)
  const { data: recentRows, error: recentErr } = await recentQuery

  if (recentErr) {
    console.warn('[ai_usage_logs] recent fetch failed', recentErr.message)
  }

  return {
    totalUsd: Math.round(totalUsd * 1_000_000) / 1_000_000,
    telegramUsd: Math.round(telegramUsd * 1_000_000) / 1_000_000,
    webUsd: Math.round(webUsd * 1_000_000) / 1_000_000,
    embeddingUsd: Math.round(embeddingUsd * 1_000_000) / 1_000_000,
    requestCount,
    recent: recentRows || [],
    error: aggError,
    period,
  }
}

/**
 * @param {object} p
 * @param {string} [p.userId]
 * @param {string|null} [p.listingId]
 * @param {string} p.taskType
 * @param {string} p.model
 * @param {object} [p.usage] OpenAI usage object
 * @param {object} [p.metadata]
 */
export async function insertAiUsageLog(p) {
  if (!supabaseAdmin) return { ok: false, skipped: true }
  const usage = p.usage || {}
  const pt = Number(usage.prompt_tokens) || 0
  const ct = Number(usage.completion_tokens) || 0
  const tt = Number(usage.total_tokens) || pt + ct || null
  const cost = estimateOpenAiCostUsd(p.model, usage)
  // user_id / listing_id в БД — TEXT; всегда строки для совместимости с FK
  const row = {
    user_id: p.userId != null && String(p.userId).trim() ? String(p.userId).trim() : null,
    listing_id:
      p.listingId != null && String(p.listingId).trim() ? String(p.listingId).trim() : null,
    task_type: p.taskType,
    model: p.model,
    prompt_tokens: pt || null,
    completion_tokens: ct || null,
    total_tokens: tt,
    cost_usd: cost,
    metadata: p.metadata && typeof p.metadata === 'object' ? p.metadata : {},
  }
  const { error } = await supabaseAdmin.from('ai_usage_logs').insert(row)
  if (error) {
    console.warn('[ai_usage_logs] insert failed', error.message)
    return { ok: false, error }
  }
  return { ok: true }
}

/**
 * Квота: ≤3 генераций на listing_id; для черновика без id — ≤3 на user_id с listing_id IS NULL.
 * @param {string} userId
 * @param {string|null|undefined} listingId
 * @param {string} taskType
 */
export async function countAiGenerationsForQuota(userId, listingId, taskType = TASK_LISTING_DESCRIPTION) {
  if (!supabaseAdmin) return { count: 0, error: null }
  let q = supabaseAdmin
    .from('ai_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('task_type', taskType)

  const uid = userId != null ? String(userId).trim() : ''
  if (listingId && String(listingId).trim()) {
    q = q.eq('listing_id', String(listingId).trim())
  } else {
    q = q.is('listing_id', null).eq('user_id', uid)
  }

  const { count, error } = await q
  if (error) {
    console.warn('[ai_usage_logs] count failed', error.message)
    return { count: 0, error }
  }
  return { count: count || 0, error: null }
}

export function quotaRemaining(usedCount) {
  return Math.max(0, QUOTA_PER_LISTING - (usedCount || 0))
}

export function quotaLimit() {
  return QUOTA_PER_LISTING
}

/**
 * Суммарная стоимость ИИ за календарный месяц (UTC) для партнёра.
 * @param {string} userId
 * @param {Date} [now]
 */
export async function sumPartnerAiCostUsdForMonth(userId, now = new Date()) {
  if (!supabaseAdmin || !userId) return { totalUsd: 0, error: null }
  const uid = String(userId).trim()
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
  const { data, error } = await supabaseAdmin
    .from('ai_usage_logs')
    .select('cost_usd')
    .eq('user_id', uid)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())

  if (error) {
    console.warn('[ai_usage_logs] sum month failed', error.message)
    return { totalUsd: 0, error }
  }
  let total = 0
  for (const r of data || []) {
    const v = parseFloat(r.cost_usd)
    if (Number.isFinite(v)) total += v
  }
  return { totalUsd: Math.round(total * 1_000_000) / 1_000_000, error: null }
}

/**
 * Суммарные затраты OpenAI за календарный месяц (UTC) по всем пользователям (админ-аналитика).
 */
export async function sumGlobalAiCostUsdForMonth(now = new Date()) {
  if (!supabaseAdmin) return { totalUsd: 0, requestCount: 0, error: null }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0))
  const { data, error } = await supabaseAdmin
    .from('ai_usage_logs')
    .select('cost_usd')
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString())

  if (error) {
    console.warn('[ai_usage_logs] global sum month failed', error.message)
    return { totalUsd: 0, requestCount: 0, error }
  }
  const rows = data || []
  let total = 0
  for (const r of rows) {
    const v = parseFloat(r.cost_usd)
    if (Number.isFinite(v)) total += v
  }
  return {
    totalUsd: Math.round(total * 1_000_000) / 1_000_000,
    requestCount: rows.length,
    error: null,
  }
}
