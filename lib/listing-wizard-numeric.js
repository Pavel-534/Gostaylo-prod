/**
 * Числовые поля мастера объявления: только цифры, без ведущих нулей.
 */

export function stripDigits(raw) {
  return String(raw ?? '').replace(/\D/g, '')
}

/**
 * @param {string|number} raw
 * @param {number} min
 * @param {number} max
 * @param {number} fallbackIfEmpty — если строка пустая после очистки
 */
export function clampIntFromDigits(raw, min, max, fallbackIfEmpty) {
  const d = stripDigits(raw)
  if (d === '') return fallbackIfEmpty
  let n = parseInt(d, 10)
  if (Number.isNaN(n)) return fallbackIfEmpty
  return Math.min(max, Math.max(min, n))
}

/** Только цифры для цены в THB (строка в стейте). */
export function sanitizeThbDigits(raw) {
  return stripDigits(raw)
}
