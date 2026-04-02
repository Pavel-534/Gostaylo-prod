/**
 * Векторные эмбеддинги объявлений (смысловой поиск).
 * Запись в listings.embedding через RPC set_listing_embedding (см. миграцию SQL).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { insertAiUsageLog, TASK_EMBEDDING } from '@/lib/ai/usage-log'

export const EMBEDDING_MODEL = 'text-embedding-3-small'

const MAX_INPUT_CHARS = 28_000

function stripForEmbedding(text) {
  if (!text || typeof text !== 'string') return ''
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Текст для одной записи в индекс.
 */
export function buildListingEmbeddingInput({ title, description, district, categoryName }) {
  const t = stripForEmbedding(title || '')
  const d = stripForEmbedding(description || '')
  const dist = stripForEmbedding(district || '')
  const cat = stripForEmbedding(categoryName || '')
  const body = `Title: ${t}\nCategory: ${cat}\nDistrict: ${dist}\nDescription: ${d}`.slice(0, MAX_INPUT_CHARS)
  return body
}

/**
 * @typedef {{ title?: string, description?: string, district?: string, categoryName?: string }} SemanticOverride
 */

/**
 * Обновить embedding для объявления: OpenAI + ai_usage_logs + БД.
 * @param {string} listingId
 * @param {SemanticOverride|null} [semanticOverride] — подмешать свежий текст (например сразу после ИИ до сохранения в БД)
 * @returns {Promise<{ ok: boolean, error?: string, skipped?: boolean }>}
 */
export async function updateListingEmbedding(listingId, semanticOverride = null) {
  const id = listingId != null ? String(listingId).trim() : ''
  if (!id) return { ok: false, error: 'missing_listing_id' }
  if (!supabaseAdmin) return { ok: false, error: 'no_supabase_admin' }

  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    console.warn('[listing-embedding] OPENAI_API_KEY missing')
    return { ok: false, error: 'no_openai_key' }
  }

  const { data: row, error: fetchErr } = await supabaseAdmin
    .from('listings')
    .select('id, owner_id, title, description, district, category_id, categories ( name, slug )')
    .eq('id', id)
    .maybeSingle()

  if (fetchErr || !row) {
    console.warn('[listing-embedding] listing not found', id, fetchErr?.message)
    return { ok: false, error: 'listing_not_found' }
  }

  const cat = row.categories
  const categoryNameFromDb =
    (cat && typeof cat === 'object' && (cat.name || cat.slug)) ? String(cat.name || cat.slug) : ''

  const ov = semanticOverride && typeof semanticOverride === 'object' ? semanticOverride : {}
  const title = ov.title !== undefined ? ov.title : row.title
  const description = ov.description !== undefined ? ov.description : row.description
  const district = ov.district !== undefined ? ov.district : row.district
  const categoryName =
    ov.categoryName !== undefined ? String(ov.categoryName || '') : categoryNameFromDb

  const input = buildListingEmbeddingInput({
    title,
    description,
    district,
    categoryName,
  })

  if (!input.replace(/\s/g, '').length) {
    return { ok: false, error: 'empty_input' }
  }

  let res
  try {
    res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input,
      }),
    })
  } catch (e) {
    console.warn('[listing-embedding] fetch failed', e?.message)
    return { ok: false, error: 'openai_network' }
  }

  const raw = await res.json().catch(() => ({}))
  const usage = raw?.usage || {}
  const model = raw?.model || EMBEDDING_MODEL

  await insertAiUsageLog({
    userId: row.owner_id,
    listingId: id,
    taskType: TASK_EMBEDDING,
    model,
    usage: {
      prompt_tokens: usage.prompt_tokens ?? usage.total_tokens,
      completion_tokens: 0,
      total_tokens: usage.total_tokens,
    },
    metadata: { inputChars: input.length, http_ok: res.ok },
  })

  if (!res.ok) {
    console.warn('[listing-embedding] OpenAI error', raw?.error?.message || res.status)
    return { ok: false, error: raw?.error?.message || 'openai_error' }
  }

  const embedding = raw?.data?.[0]?.embedding
  if (!Array.isArray(embedding) || embedding.length !== 1536) {
    console.warn('[listing-embedding] bad embedding length', embedding?.length)
    return { ok: false, error: 'bad_embedding' }
  }

  const pEmbedding = JSON.stringify(embedding)
  const { error: rpcErr } = await supabaseAdmin.rpc('set_listing_embedding', {
    p_listing_id: id,
    p_embedding: pEmbedding,
  })

  if (rpcErr) {
    console.warn('[listing-embedding] RPC set_listing_embedding failed', rpcErr.message)
    return { ok: false, error: rpcErr.message }
  }

  return { ok: true }
}

/**
 * Фоновое обновление (не блокирует ответ API).
 * @param {string|null|undefined} listingId
 * @param {SemanticOverride|null} [semanticOverride]
 */
export function scheduleListingEmbeddingRefresh(listingId, semanticOverride = null) {
  const id = listingId != null && String(listingId).trim() ? String(listingId).trim() : ''
  if (!id) return
  void updateListingEmbedding(id, semanticOverride).catch((e) =>
    console.warn('[listing-embedding] async', id, e?.message || e),
  )
}
