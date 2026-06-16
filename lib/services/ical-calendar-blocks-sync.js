/**
 * Единая точка: разбор iCal → диапазоны YYYY-MM-DD → запись в `calendar_blocks`.
 * Stage 152.1 — Floating Local Date: listing timezone SSOT, no hour-7 hack.
 */

import {
  compactYmdToIsoDate,
  lastOccupiedDateFromExclusiveAllDayDtend,
} from '@/lib/ical-all-day-range'
import { addListingDays, listingDateToday, toListingDate } from '@/lib/listing-date'
import { resolveListingTimeZoneFromMetadata } from '@/lib/geo/listing-timezone-ssot'
import { getIcalSyncUserAgent } from '@/lib/http-client-identity'

function isValidIanaTimeZone(value) {
  const tz = String(value || '').trim()
  if (!tz) return false
  try {
    Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return true
  } catch {
    return false
  }
}

/**
 * @param {string} paramsUpper
 * @returns {string|null}
 */
function extractTzidFromParams(paramsUpper) {
  const m = String(paramsUpper || '').match(/TZID=([^:;]+)/i)
  return m ? String(m[1]).trim() : null
}

/**
 * @param {string} yyyymmdd — 8 digits
 * @returns {string|null}
 */
function ymdDigitsToIso(yyyymmdd) {
  const ds = String(yyyymmdd || '').trim().slice(0, 8)
  return /^\d{8}$/.test(ds) ? compactYmdToIsoDate(ds) : null
}

/**
 * Parse UTC instant from compact iCal datetime ending with Z.
 * @param {string} raw
 * @returns {Date|null}
 */
function parseIcalUtcInstant(raw) {
  const s = String(raw || '').trim()
  if (!s.includes('T') || !s.endsWith('Z')) return null
  const datePart = s.split('T')[0]
  const timePart = s.split('T')[1]?.replace('Z', '') || '000000'
  if (!/^\d{8}$/.test(datePart)) return null
  const year = parseInt(datePart.slice(0, 4), 10)
  const month = parseInt(datePart.slice(4, 6), 10) - 1
  const day = parseInt(datePart.slice(6, 8), 10)
  const hour = parseInt(timePart.slice(0, 2) || '0', 10)
  const minute = parseInt(timePart.slice(2, 4) || '0', 10)
  const second = parseInt(timePart.slice(4, 6) || '0', 10)
  return new Date(Date.UTC(year, month, day, hour, minute, second))
}

/**
 * Floating local YYYY-MM-DD from DTSTART/DTEND value (no hour-7 hack).
 * @param {string} value
 * @param {string} paramsUpper
 * @param {string} listingTimeZone
 * @returns {string|null}
 */
function icalValueToLocalYmd(value, paramsUpper, listingTimeZone) {
  let s = String(value || '').replace(/^VALUE=DATE:/i, '').trim()
  if (!s) return null

  const eightDigit = s.replace(/^VALUE=DATE:/i, '').trim().slice(0, 8)
  if (/^\d{8}$/.test(eightDigit) && !s.includes('T')) {
    return ymdDigitsToIso(eightDigit)
  }

  if (s.includes('T')) {
    const datePart = s.split('T')[0]
    if (!/^\d{8}$/.test(datePart)) return null

    if (s.endsWith('Z')) {
      const utc = parseIcalUtcInstant(s)
      return utc ? toListingDate(utc, listingTimeZone) : ymdDigitsToIso(datePart)
    }

    const tzid = extractTzidFromParams(paramsUpper)
    if (tzid && isValidIanaTimeZone(tzid)) {
      const timePart = s.split('T')[1] || '000000'
      const hour = parseInt(timePart.slice(0, 2) || '0', 10)
      const minute = parseInt(timePart.slice(2, 4) || '0', 10)
      const second = parseInt(timePart.slice(4, 6) || '0', 10)
      const year = parseInt(datePart.slice(0, 4), 10)
      const month = parseInt(datePart.slice(4, 6), 10) - 1
      const day = parseInt(datePart.slice(6, 8), 10)
      const utcGuess = Date.UTC(year, month, day, hour, minute, second)
      return toListingDate(new Date(utcGuess), tzid)
    }

    // Floating local date: calendar day from DT* components only.
    return ymdDigitsToIso(datePart)
  }

  const t = Date.parse(s)
  if (Number.isNaN(t)) return null
  return toListingDate(new Date(t), listingTimeZone)
}

/**
 * Last occupied night (inclusive end_date) from DTEND value.
 * @param {string} endValue
 * @param {string} endParamsUpper
 * @param {string} listingTimeZone
 * @param {boolean} endAllDay
 */
function icalEndToOccupiedEndYmd(endValue, endParamsUpper, listingTimeZone, endAllDay) {
  if (endAllDay) {
    const de = String(endValue || '').replace(/^VALUE=DATE:/i, '').trim().slice(0, 8)
    if (/^\d{8}$/.test(de)) {
      return lastOccupiedDateFromExclusiveAllDayDtend(de)
    }
  }

  const endLocal = icalValueToLocalYmd(endValue, endParamsUpper, listingTimeZone)
  if (!endLocal) return null
  return addListingDays(endLocal, -1)
}

/**
 * @param {string} icsContent
 * @param {{ listingTimeZone?: string }} [options]
 * @returns {{ uid: string|null, summary: string, start_date: string, end_date: string }[]}
 */
export function parseIcalToOccupancyRanges(icsContent, options = {}) {
  const listingTimeZone = isValidIanaTimeZone(options.listingTimeZone)
    ? String(options.listingTimeZone).trim()
    : resolveListingTimeZoneFromMetadata(null)

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
          start_date = icalValueToLocalYmd(startVal, startParams, listingTimeZone)
          end_date = icalEndToOccupiedEndYmd(endVal, endParams, listingTimeZone, endAllDay)
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
 * @param {string} url
 * @param {{ timeoutMs?: number, userAgent?: string }} [opts]
 */
export async function fetchIcalDocument(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000
  const userAgent = opts.userAgent ?? getIcalSyncUserAgent()
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
 * @param {string} [listingTimeZone]
 */
export function filterOccupancyRangesByEndDate(ranges, onlyFutureEnding = true, listingTimeZone) {
  if (!onlyFutureEnding) return ranges
  const today = listingDateToday(listingTimeZone)
  return ranges.filter((r) => r.end_date >= today)
}

/**
 * Заменить блоки одного iCal-источника атомарно (RPC `replace_calendar_blocks_for_source_v1`).
 * @param {*} supabase — SupabaseClient
 */
export async function replaceCalendarBlocksForSource(
  supabase,
  { listingId, sourceUrl, ranges, platformLabel = 'External' },
) {
  const blocks = (ranges || []).map((e) => ({
    start_date: e.start_date,
    end_date: e.end_date,
    reason: e.summary || `${platformLabel} booking`,
  }))

  const { data: rows, error } = await supabase.rpc('replace_calendar_blocks_for_source_v1', {
    p_listing_id: listingId,
    p_source: sourceUrl,
    p_blocks: blocks,
  })

  if (error) {
    const msg = String(error.message || '')
    if (msg.includes('replace_calendar_blocks_for_source_v1') || error.code === 'PGRST202') {
      return {
        ok: false,
        error: 'replace_calendar_blocks_for_source_v1 RPC missing — apply migrations/stage152_02_replace_calendar_blocks_atomic.sql',
        inserted: 0,
      }
    }
    return { ok: false, error: msg || 'RPC_FAILED', inserted: 0 }
  }

  const row = Array.isArray(rows) ? rows[0] : null
  if (!row?.ok) {
    return {
      ok: false,
      error: row?.error_code || 'REPLACE_BLOCKS_FAILED',
      inserted: 0,
    }
  }

  return {
    ok: true,
    inserted: Number(row.inserted_count) || 0,
    deleted: Number(row.deleted_count) || 0,
  }
}

/**
 * @param {*} supabase
 * @param {string} listingId
 * @param {{ url: string, platform?: string, source?: string }} sourceConfig
 * @param {{
 *   timeoutMs?: number,
 *   onlyFutureEnding?: boolean,
 *   userAgent?: string,
 *   listingTitle?: string|null,
 *   listingTimeZone?: string,
 * }} [options]
 */
export async function syncIcalSourceToCalendarBlocks(supabase, listingId, sourceConfig, options = {}) {
  const url = sourceConfig?.url
  if (!url) {
    return { status: 'error', events_count: 0, error_message: 'No URL' }
  }

  const platformLabel = sourceConfig.source || sourceConfig.platform || 'External'
  const onlyFutureEnding = options.onlyFutureEnding !== false

  let listingTimeZone = options.listingTimeZone
  if (!listingTimeZone) {
    const { data: listingRow } = await supabase
      .from('listings')
      .select('metadata')
      .eq('id', listingId)
      .maybeSingle()
    listingTimeZone = resolveListingTimeZoneFromMetadata(listingRow?.metadata)
  }

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
    ranges = parseIcalToOccupancyRanges(fetchResult.text, { listingTimeZone })
  } catch (e) {
    return {
      status: 'error',
      events_count: 0,
      error_message: e?.message || 'iCal parse failed',
    }
  }
  ranges = filterOccupancyRangesByEndDate(ranges, onlyFutureEnding, listingTimeZone)

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
 * @param {*} supabase
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

export default {
  parseIcalToOccupancyRanges,
  fetchIcalDocument,
  filterOccupancyRangesByEndDate,
  replaceCalendarBlocksForSource,
  syncIcalSourceToCalendarBlocks,
  insertIcalSyncLog,
}
