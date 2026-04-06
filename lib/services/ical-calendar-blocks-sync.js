/**
 * Единая точка: разбор iCal → диапазоны YYYY-MM-DD → запись в `calendar_blocks`.
 * Используют: /api/cron/ical-sync, /api/ical/sync, /api/v2/admin/ical.
 */

import {
  compactYmdToIsoDate,
  lastOccupiedDateFromExclusiveAllDayDtend,
  lastOccupiedNightIsoFromDtendDate,
} from '@/lib/ical-all-day-range'
import { listingDateToday, toListingDate } from '@/lib/listing-date'

export const ICAL_SYNC_USER_AGENT = 'GoStayLo-Calendar-Sync/1.0'

/**
 * @param {string} dateStr
 * @returns {Date|null}
 */
function parseICalDateValue(dateStr) {
  if (!dateStr) return null
  let s = String(dateStr).replace('VALUE=DATE:', '').trim()

  if (s.length === 8 && /^\d{8}$/.test(s)) {
    const year = parseInt(s.slice(0, 4), 10)
    const month = parseInt(s.slice(4, 6), 10) - 1
    const day = parseInt(s.slice(6, 8), 10)
    return new Date(Date.UTC(year, month, day, 0, 0, 0))
  }

  if (s.includes('T')) {
    const datePart = s.split('T')[0]
    const timePart = s.split('T')[1]?.replace('Z', '') || '000000'
    const year = parseInt(datePart.slice(0, 4), 10)
    const month = parseInt(datePart.slice(4, 6), 10) - 1
    const day = parseInt(datePart.slice(6, 8), 10)
    const hour = parseInt(timePart.slice(0, 2) || '0', 10)
    const minute = parseInt(timePart.slice(2, 4) || '0', 10)

    if (s.endsWith('Z')) {
      return new Date(Date.UTC(year, month, day, hour, minute, 0))
    }
    return new Date(Date.UTC(year, month, day, hour - 7, minute, 0))
  }

  const t = Date.parse(s)
  return Number.isNaN(t) ? null : new Date(t)
}

/**
 * Извлечь значение после первого `:` с учётом параметров (DTSTART;TZID=…:…).
 * @param {string} line
 */
function propValueAfterColon(line) {
  const idx = line.indexOf(':')
  return idx >= 0 ? line.slice(idx + 1).trim() : ''
}

/**
 * Параметры до `:` в верхнем регистре для поиска VALUE=DATE.
 * @param {string} line
 */
function propParamsUpper(line) {
  const idx = line.indexOf(':')
  if (idx <= 0) return ''
  return line.slice(0, idx).toUpperCase()
}

/**
 * Развернуть folded строки RFC 5545.
 * @param {string} icsContent
 * @returns {string[]}
 */
function unfoldIcalLines(icsContent) {
  const lines = String(icsContent || '').split(/\r?\n/)
  const out = []
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]
    while (i + 1 < lines.length && (lines[i + 1]?.startsWith(' ') || lines[i + 1]?.startsWith('\t'))) {
      line += lines[i + 1].substring(1)
      i++
    }
    out.push(line)
  }
  return out
}

/**
 * @param {string} icsContent
 * @returns {{ uid: string|null, summary: string, start_date: string, end_date: string }[]}
 */
export function parseIcalToOccupancyRanges(icsContent) {
  const ranges = []
  const lines = unfoldIcalLines(icsContent)
  let current = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = { uid: null, summary: '', dtstartLine: null, dtendLine: null }
      continue
    }
    if (line === 'END:VEVENT' && current) {
      const startLine = current.dtstartLine
      const endLine = current.dtendLine
      if (startLine && endLine) {
        const startParams = propParamsUpper(startLine)
        const endParams = propParamsUpper(endLine)
        const startVal = propValueAfterColon(startLine)
        const endVal = propValueAfterColon(endLine)
        const startAllDay =
          startParams.includes('VALUE=DATE') || /^\d{8}$/.test(startVal.replace(/^VALUE=DATE:/i, '').trim())
        const endAllDay =
          endParams.includes('VALUE=DATE') || /^\d{8}$/.test(endVal.replace(/^VALUE=DATE:/i, '').trim())

        let start_date = null
        let end_date = null

        if (startAllDay && endAllDay) {
          const ds = startVal.replace(/^VALUE=DATE:/i, '').trim().slice(0, 8)
          const de = endVal.replace(/^VALUE=DATE:/i, '').trim().slice(0, 8)
          if (/^\d{8}$/.test(ds) && /^\d{8}$/.test(de)) {
            start_date = compactYmdToIsoDate(ds)
            end_date = lastOccupiedDateFromExclusiveAllDayDtend(de)
          }
        }

        if (!start_date || !end_date) {
          const dts = parseICalDateValue(startVal)
          const dte = parseICalDateValue(endVal)
          if (dts && dte && dte > dts) {
            start_date = toListingDate(dts)
            end_date = lastOccupiedNightIsoFromDtendDate(dte)
          }
        }

        if (start_date && end_date && start_date <= end_date) {
          ranges.push({
            uid: current.uid,
            summary: current.summary || 'Blocked',
            start_date,
            end_date,
          })
        }
      }
      current = null
      continue
    }

    if (!current) continue

    const colon = line.indexOf(':')
    if (colon <= 0) continue
    const key = line.substring(0, colon).split(';')[0].toUpperCase()
    const value = line.substring(colon + 1).trim()

    switch (key) {
      case 'UID':
        current.uid = value
        break
      case 'SUMMARY':
        current.summary = value
        break
      case 'DTSTART':
        current.dtstartLine = line
        break
      case 'DTEND':
        current.dtendLine = line
        break
      default:
        break
    }
  }

  return ranges
}

/**
 * @param {string} url
 * @param {{ timeoutMs?: number, userAgent?: string }} [opts]
 */
export async function fetchIcalDocument(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000
  const userAgent = opts.userAgent ?? ICAL_SYNC_USER_AGENT
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': userAgent, Accept: 'text/calendar, */*' },
    })
    clearTimeout(timeout)
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const text = await res.text()
    if (!text.includes('BEGIN:VCALENDAR')) {
      return { ok: false, error: 'Invalid iCal format' }
    }
    return { ok: true, text }
  } catch (e) {
    clearTimeout(timeout)
    return { ok: false, error: e?.name === 'AbortError' ? 'Timeout' : e?.message || 'Fetch failed' }
  }
}

/**
 * @param {{ start_date: string, end_date: string, summary: string, uid?: string|null }[]} ranges
 * @param {boolean} [onlyFutureEnding]
 */
export function filterOccupancyRangesByEndDate(ranges, onlyFutureEnding = true) {
  if (!onlyFutureEnding) return ranges
  const today = listingDateToday()
  return ranges.filter((r) => r.end_date >= today)
}

/**
 * Заменить блоки одного iCal-источника: сначала вставка новых строк, затем удаление старых id.
 * При ошибке вставки существующие блоки не трогаем. При ошибке удаления после вставки — откат новых id.
 * @param {*} supabase — SupabaseClient
 */
export async function replaceCalendarBlocksForSource(
  supabase,
  { listingId, sourceUrl, ranges, platformLabel = 'External' },
) {
  const { data: existing, error: selErr } = await supabase
    .from('calendar_blocks')
    .select('id')
    .eq('listing_id', listingId)
    .eq('source', sourceUrl)

  if (selErr) {
    return { ok: false, error: selErr.message, inserted: 0 }
  }

  const oldIds = (existing || []).map((r) => r.id).filter(Boolean)

  const blocks = ranges.map((e) => ({
    listing_id: listingId,
    start_date: e.start_date,
    end_date: e.end_date,
    reason: e.summary || `${platformLabel} booking`,
    source: sourceUrl,
  }))

  /** @type {string[]} */
  let newIds = []

  if (blocks.length > 0) {
    const { data: inserted, error: insErr } = await supabase.from('calendar_blocks').insert(blocks).select('id')
    if (insErr) {
      return { ok: false, error: insErr.message, inserted: 0 }
    }
    newIds = (inserted || []).map((r) => r.id).filter(Boolean)
  }

  if (oldIds.length > 0) {
    const { error: delErr } = await supabase.from('calendar_blocks').delete().in('id', oldIds)
    if (delErr) {
      if (newIds.length > 0) {
        await supabase.from('calendar_blocks').delete().in('id', newIds)
      }
      return { ok: false, error: delErr.message, inserted: 0 }
    }
  }

  return { ok: true, inserted: blocks.length }
}

/**
 * Полный цикл: fetch → parse → (опц.) фильтр будущего → replace blocks → (опц.) лог.
 * @param {*} supabase
 * @param {string} listingId
 * @param {{ url: string, platform?: string, source?: string }} sourceConfig
 * @param {{
 *   timeoutMs?: number,
 *   onlyFutureEnding?: boolean,
 *   userAgent?: string,
 *   listingTitle?: string|null,
 * }} [options]
 */
export async function syncIcalSourceToCalendarBlocks(supabase, listingId, sourceConfig, options = {}) {
  const url = sourceConfig?.url
  if (!url) {
    return { status: 'error', events_count: 0, error_message: 'No URL' }
  }

  const platformLabel = sourceConfig.source || sourceConfig.platform || 'External'
  const onlyFutureEnding = options.onlyFutureEnding !== false

  const fetchResult = await fetchIcalDocument(url, {
    timeoutMs: options.timeoutMs ?? 15000,
    userAgent: options.userAgent,
  })

  if (!fetchResult.ok) {
    return {
      status: 'error',
      events_count: 0,
      error_message: fetchResult.error || 'Fetch failed',
    }
  }

  let ranges
  try {
    ranges = parseIcalToOccupancyRanges(fetchResult.text)
  } catch (e) {
    return {
      status: 'error',
      events_count: 0,
      error_message: e?.message || 'iCal parse failed',
    }
  }
  ranges = filterOccupancyRangesByEndDate(ranges, onlyFutureEnding)

  const write = await replaceCalendarBlocksForSource(supabase, {
    listingId,
    sourceUrl: url,
    ranges,
    platformLabel,
  })

  if (!write.ok) {
    return {
      status: 'error',
      events_count: 0,
      error_message: write.error || 'Write failed',
    }
  }

  return {
    status: 'success',
    events_count: write.inserted,
    error_message: null,
  }
}

/**
 * Запись в `ical_sync_logs` (схема как у cron).
 * @param {*} supabase
 * @param {{
 *   listing_id: string,
 *   source_url: string,
 *   status: string,
 *   events_count: number,
 *   error_message: string|null,
 *   listing_title?: string|null,
 * }} row
 */
export async function insertIcalSyncLog(supabase, row) {
  const payload = {
    listing_id: row.listing_id,
    source_url: row.source_url,
    status: row.status,
    events_count: row.events_count,
    error_message: row.error_message,
    synced_at: new Date().toISOString(),
  }
  if (row.listing_title != null) {
    payload.listing_title = row.listing_title
  }
  await supabase.from('ical_sync_logs').insert(payload)
}
