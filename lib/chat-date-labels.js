import { isToday, isYesterday, startOfDay, format } from 'date-fns'
import { ru, enUS } from 'date-fns/locale'

/**
 * Подпись дня для разделителя в чате (Today / Yesterday / дата).
 */
export function chatDayLabel(iso, lang = 'ru') {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const locale = lang === 'ru' ? ru : enUS
  if (isToday(d)) return lang === 'ru' ? 'Сегодня' : 'Today'
  if (isYesterday(d)) return lang === 'ru' ? 'Вчера' : 'Yesterday'
  return format(d, 'd MMMM yyyy', { locale })
}

export function chatNeedsDaySeparator(prevIso, currIso) {
  if (!currIso) return false
  if (!prevIso) return true
  const da = new Date(prevIso)
  const db = new Date(currIso)
  if (Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false
  const a = startOfDay(da).getTime()
  const b = startOfDay(db).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return false
  return a !== b
}
