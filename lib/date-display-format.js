/**
 * Единый формат отображения дат в UI (дд.мм.гггг), без зависимости от локали браузера.
 * Значения в URL/API по-прежнему могут быть yyyy-MM-dd.
 */

import { format } from 'date-fns'

/** Паттерн для подписей в полях выбора дат и календаря */
export const DISPLAY_DATE_PATTERN = 'dd.MM.yyyy'

/**
 * @param {Date|string|number} dateLike
 * @returns {string}
 */
export function formatDisplayDate(dateLike) {
  const d = dateLike instanceof Date ? dateLike : new Date(dateLike)
  if (Number.isNaN(d.getTime())) return ''
  return format(d, DISPLAY_DATE_PATTERN)
}

/**
 * Диапазон «с — по» для триггеров календаря.
 * @param {Date|null|undefined} from
 * @param {Date|null|undefined} to
 * @param {{ pendingToLabel?: string }} [opts]
 */
export function formatDisplayDateRange(from, to, opts = {}) {
  const pending = opts.pendingToLabel ?? '…'
  if (!from) return ''
  const a = formatDisplayDate(from)
  if (!to) return `${a} — ${pending}`
  return `${a} — ${formatDisplayDate(to)}`
}
