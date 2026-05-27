/**
 * Stage 118.3 — единый стиль сумм в финансовых таблицах админки.
 */

/**
 * @param {unknown} value
 * @param {{ currency?: string, showPlus?: boolean }} [opts]
 */
export function formatSignedAmountThb(value, opts = {}) {
  const x = Number(value)
  if (!Number.isFinite(x)) return '—'
  const cur = opts.currency || 'THB'
  const abs = Math.abs(x).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
  const sign = x > 0 ? (opts.showPlus === false ? '' : '+') : x < 0 ? '−' : ''
  const suffix = cur === 'THB' ? '' : ` ${cur}`
  return `${sign}${abs}${suffix}`
}

/**
 * @param {unknown} value
 */
export function signedAmountToneClass(value) {
  const x = Number(value)
  if (!Number.isFinite(x) || x === 0) return 'text-slate-500'
  if (x > 0) return 'text-emerald-700'
  return 'text-rose-700'
}

/**
 * @param {unknown} value
 */
export function signedAmountCellClass(value) {
  return `font-mono tabular-nums text-right font-medium ${signedAmountToneClass(value)}`
}
