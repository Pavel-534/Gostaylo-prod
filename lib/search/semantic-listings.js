/**
 * Семантический поиск объявлений: эмбеддинг запроса + match_listings в БД.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { embedSearchQueryText } from '@/lib/ai/query-embedding'
import { insertAiUsageLog, TASK_SEARCH_QUERY } from '@/lib/ai/usage-log'

/** Не показывать результаты с similarity ниже порога (косинусная метрика из match_listings). */
export const SEMANTIC_MIN_SIMILARITY = 0.3

/**
 * Подмешать порядок: сначала объявления из семантической выдачи (в порядке релевантности), затем остальные.
 * @param {object[]} listings
 * @param {{ id: string, similarity?: number }[]} semanticHits
 * @param {number} [minSimilarity]
 * @returns {object[]}
 */
export function mergeSemanticHitsIntoListingOrder(listings, semanticHits, minSimilarity = SEMANTIC_MIN_SIMILARITY) {
  if (!Array.isArray(listings) || listings.length === 0) return listings || []
  if (!Array.isArray(semanticHits) || semanticHits.length === 0) return listings

  const filtered = semanticHits.filter((h) => Number(h.similarity) >= minSimilarity)
  if (!filtered.length) return listings

  const rank = new Map(filtered.map((h, idx) => [String(h.id), { idx, sim: Number(h.similarity) }]))
  const boosted = []
  const rest = []
  for (const l of listings) {
    const id = String(l.id)
    const r = rank.get(id)
    if (r) boosted.push({ listing: l, ...r })
    else rest.push(l)
  }
  boosted.sort((a, b) => a.idx - b.idx)
  return [...boosted.map((x) => x.listing), ...rest]
}

/**
 * @param {string} q
 * @param {object} [opts]
 * @param {number} [opts.matchCount] — лимит для RPC (до 100)
 * @param {string} [opts.filterStatus] — по умолчанию ACTIVE
 * @param {boolean} [opts.logToAiUsage] — писать в ai_usage_logs (task search_query)
 * @returns {Promise<{ id: string, similarity: number, title?: string, district?: string }[]>}
 */
export async function fetchSemanticListingMatches(q, opts = {}) {
  const {
    matchCount = 40,
    filterStatus = 'ACTIVE',
    logToAiUsage = true,
  } = opts

  const queryText = String(q || '').trim()
  if (queryText.length < 2) return []

  const apiKey = process.env.OPENAI_API_KEY?.trim()

  /** Одна строка в ai_usage_logs на каждый поисковый запрос */
  async function logOnce(embedResult, extraMeta) {
    if (!logToAiUsage || !supabaseAdmin) return
    await insertAiUsageLog({
      taskType: TASK_SEARCH_QUERY,
      model: embedResult?.model || 'text-embedding-3-small',
      usage: embedResult?.usage || {},
      metadata: {
        qLen: queryText.length,
        ...extraMeta,
      },
    })
  }

  if (!apiKey || !supabaseAdmin) {
    await logOnce({}, { error: 'no_openai_or_supabase' })
    return []
  }

  const embed = await embedSearchQueryText(queryText, apiKey)

  if (!embed.ok || !embed.embeddingJson) {
    await logOnce(embed, {
      embed_ok: false,
      embed_error: embed.error || 'embed_failed',
      hits_above_threshold: 0,
    })
    return []
  }

  const mc = Math.min(100, Math.max(1, Math.floor(Number(matchCount)) || 40))
  const { data, error } = await supabaseAdmin.rpc('match_listings', {
    query_embedding: embed.embeddingJson,
    match_count: mc,
    filter_status: filterStatus,
  })

  if (error) {
    console.warn('[semantic-search] match_listings RPC failed', error.message)
    await logOnce(embed, {
      embed_ok: true,
      rpc_error: error.message,
      hits_above_threshold: 0,
    })
    return []
  }

  const rows = Array.isArray(data) ? data : []
  const mapped = rows.map((r) => ({
    id: String(r.id),
    similarity: Number(r.similarity) || 0,
    title: r.title,
    district: r.district,
  }))
  const filtered = mapped.filter((r) => r.similarity >= SEMANTIC_MIN_SIMILARITY)

  await logOnce(embed, {
    embed_ok: true,
    rpc_rows: mapped.length,
    hits_above_threshold: filtered.length,
  })

  return filtered
}
