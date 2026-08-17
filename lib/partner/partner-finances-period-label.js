/**
 * Display-only period label for partner finances CSV/reports chrome.
 * Does not change export math or UTC day bounds.
 */

import { endOfMonth, endOfQuarter, format, startOfMonth, startOfQuarter } from 'date-fns'
import { resolvePartnerDateFnsLocale } from '@/lib/ui/partner-date-fns-locale'

function parseYmdLocal(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''))
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

function formatYmd(d) {
  return format(d, 'yyyy-MM-dd')
}

function capitalizeFirst(text) {
  const s = String(text || '')
  if (!s) return s
  return s.charAt(0).toLocaleUpperCase() + s.slice(1)
}

/**
 * @param {string} fromYmd
 * @param {string} toYmd
 * @param {string} [language]
 * @returns {string}
 */
export function formatPartnerFinancesPeriodLabel(fromYmd, toYmd, language = 'ru') {
  const from = parseYmdLocal(fromYmd)
  const to = parseYmdLocal(toYmd)
  if (!from || !to) return [fromYmd, toYmd].filter(Boolean).join(' – ')

  const locale = resolvePartnerDateFnsLocale(language)

  if (fromYmd === formatYmd(startOfMonth(from)) && toYmd === formatYmd(endOfMonth(from))) {
    return capitalizeFirst(format(from, 'LLLL yyyy', { locale }))
  }
  if (fromYmd === formatYmd(startOfQuarter(from)) && toYmd === formatYmd(endOfQuarter(from))) {
    return capitalizeFirst(format(from, 'QQQ yyyy', { locale }))
  }
  if (from.getFullYear() === to.getFullYear() && from.getMonth() === to.getMonth()) {
    return `${format(from, 'd', { locale })}–${format(to, 'd MMM yyyy', { locale })}`
  }
  if (from.getFullYear() === to.getFullYear()) {
    return `${format(from, 'd MMM', { locale })} – ${format(to, 'd MMM yyyy', { locale })}`
  }
  return `${format(from, 'd MMM yyyy', { locale })} – ${format(to, 'd MMM yyyy', { locale })}`
}
