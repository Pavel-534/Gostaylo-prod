/**
 * Примерная стоимость вызова OpenAI (USD). Тарифы можно переопределить env.
 * Ориентир: gpt-4o ~ $5/1M input, $15/1M output (уточняйте на pricing.openai.com).
 */

function numEnv(name, fallback) {
  const v = process.env[name]
  if (v == null || v === '') return fallback
  const n = parseFloat(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

/** $ per 1M prompt tokens (включая embedding-only модели) */
export function pricePerMillionInput(model) {
  const m = String(model || '').toLowerCase()
  if (m.includes('text-embedding-3-small'))
    return numEnv('OPENAI_PRICE_EMBEDDING_3_SMALL_PER_MILLION', 0.02)
  if (m.includes('text-embedding-3-large'))
    return numEnv('OPENAI_PRICE_EMBEDDING_3_LARGE_PER_MILLION', 0.13)
  if (m.includes('text-embedding')) return numEnv('OPENAI_PRICE_EMBEDDING_DEFAULT_PER_MILLION', 0.02)
  if (m.includes('gpt-4o-mini')) return numEnv('OPENAI_PRICE_4O_MINI_INPUT_PER_MILLION', 0.15)
  if (m.includes('gpt-4o')) return numEnv('OPENAI_PRICE_4O_INPUT_PER_MILLION', 5)
  return numEnv('OPENAI_PRICE_DEFAULT_INPUT_PER_MILLION', 5)
}

/** $ per 1M completion tokens */
export function pricePerMillionOutput(model) {
  const m = String(model || '').toLowerCase()
  if (m.includes('gpt-4o-mini')) return numEnv('OPENAI_PRICE_4O_MINI_OUTPUT_PER_MILLION', 0.6)
  if (m.includes('gpt-4o')) return numEnv('OPENAI_PRICE_4O_OUTPUT_PER_MILLION', 15)
  return numEnv('OPENAI_PRICE_DEFAULT_OUTPUT_PER_MILLION', 15)
}

/**
 * @param {string} model
 * @param {{ prompt_tokens?: number, completion_tokens?: number, total_tokens?: number }} usage
 */
export function estimateOpenAiCostUsd(model, usage) {
  const m = String(model || '').toLowerCase()
  const pt = Number(usage?.prompt_tokens) || 0
  const ct = Number(usage?.completion_tokens) || 0
  const pin = pricePerMillionInput(model)
  if (m.includes('text-embedding')) {
    const usd = (pt / 1_000_000) * pin
    return Math.round(usd * 1_000_000) / 1_000_000
  }
  const pout = pricePerMillionOutput(model)
  const usd = (pt / 1_000_000) * pin + (ct / 1_000_000) * pout
  return Math.round(usd * 1_000_000) / 1_000_000
}
