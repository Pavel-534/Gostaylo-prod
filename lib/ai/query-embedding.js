/**
 * Эмбеддинг произвольного текста (поисковый запрос и т.д.).
 */

import { EMBEDDING_MODEL } from '@/lib/ai/embeddings'

const MAX_QUERY_CHARS = 8_000

/**
 * @param {string} text
 * @param {string} apiKey
 * @returns {Promise<{ ok: boolean, embeddingJson?: string, usage?: object, model?: string, error?: string }>}
 */
export async function embedSearchQueryText(text, apiKey) {
  const input = String(text || '')
    .trim()
    .slice(0, MAX_QUERY_CHARS)
  if (!input) {
    return { ok: false, error: 'empty_query' }
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
    return { ok: false, error: e?.message || 'network' }
  }

  const raw = await res.json().catch(() => ({}))
  const usage = raw?.usage || {}
  const model = raw?.model || EMBEDDING_MODEL

  if (!res.ok) {
    return {
      ok: false,
      usage,
      model,
      error: raw?.error?.message || `http_${res.status}`,
    }
  }

  const vec = raw?.data?.[0]?.embedding
  if (!Array.isArray(vec) || vec.length !== 1536) {
    return { ok: false, usage, model, error: 'bad_embedding_length' }
  }

  return {
    ok: true,
    embeddingJson: JSON.stringify(vec),
    usage: {
      prompt_tokens: usage.prompt_tokens ?? usage.total_tokens,
      completion_tokens: 0,
      total_tokens: usage.total_tokens,
    },
    model,
  }
}
