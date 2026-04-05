/**
 * Слияние полей metadata.discounts.weekly | .monthly и предупреждение о порядке %.
 */

function parsePercentInput(raw) {
  const trimmed = String(raw ?? '').replace(',', '.').trim()
  if (trimmed === '') return { clear: true, value: null }
  const n = parseFloat(trimmed)
  if (!Number.isFinite(n) || n <= 0) return { clear: true, value: null }
  return { clear: false, value: Math.min(100, Math.round(n)) }
}

/**
 * @param {Record<string, unknown>} metadata
 * @param {'weekly' | 'monthly'} field
 * @param {string} raw
 * @returns {{ metadata: Record<string, unknown>, warnOrder: boolean }}
 */
export function applyDurationDiscountField(metadata, field, raw) {
  const meta = metadata && typeof metadata === 'object' ? { ...metadata } : {}
  const prev =
    meta.discounts && typeof meta.discounts === 'object' && !Array.isArray(meta.discounts)
      ? { ...meta.discounts }
      : {}
  const { clear, value } = parsePercentInput(raw)
  if (clear) delete prev[field]
  else prev[field] = value

  if (Object.keys(prev).length === 0) delete meta.discounts
  else meta.discounts = prev

  const w = meta.discounts?.weekly != null ? Number(meta.discounts.weekly) : null
  const m = meta.discounts?.monthly != null ? Number(meta.discounts.monthly) : null
  const warnOrder =
    w != null &&
    m != null &&
    Number.isFinite(w) &&
    Number.isFinite(m) &&
    m < w

  return { metadata: meta, warnOrder }
}
