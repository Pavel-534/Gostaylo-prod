/**
 * Partner finances export — date params, filename, CSV serialization (Stage 211.1).
 * Money amounts are passed in; do not compute fee/net here.
 */

import { getSiteBrandSlug } from '@/lib/site-url.js'

export const PARTNER_FINANCES_EXPORT_MAX_RANGE_DAYS = 366
export const PARTNER_FINANCES_EXPORT_MAX_ROWS = 2000

export const PARTNER_FINANCES_CSV_HEADERS = Object.freeze([
  'ID брони',
  'Объект',
  'Дата создания',
  'Дата заезда',
  'Дата выезда',
  'Сумма (THB)',
  'Комиссия (THB)',
  'Выплата партнёру (THB)',
  'Статус',
])

const YMD = /^\d{4}-\d{2}-\d{2}$/
const UTF8_BOM = '\uFEFF'

/**
 * @param {string|null|undefined} raw
 * @returns {'created'|'checkout'|null}
 */
export function resolvePartnerFinancesExportAxis(raw) {
  const axis = String(raw || 'created')
    .trim()
    .toLowerCase()
  if (!axis || axis === 'created') return 'created'
  if (axis === 'checkout') return 'checkout'
  return null
}

/**
 * @param {'created'|'checkout'} axis
 * @returns {'created_at'|'check_out'}
 */
export function partnerFinancesExportAxisColumn(axis) {
  return axis === 'checkout' ? 'check_out' : 'created_at'
}

/**
 * @param {string|null|undefined} s
 * @returns {Date|null}
 */
export function parsePartnerFinancesExportYmd(s) {
  if (!s || !YMD.test(String(s))) return null
  const d = new Date(`${s}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * @param {{ from?: string|null, to?: string|null, format?: string|null, axis?: string|null }} raw
 */
export function parsePartnerFinancesExportParams(raw = {}) {
  const fromYmd = String(raw.from || '').trim()
  const toYmd = String(raw.to || '').trim()
  const fromD = parsePartnerFinancesExportYmd(fromYmd)
  const toD = parsePartnerFinancesExportYmd(toYmd)
  if (!fromD || !toD || fromD > toD) {
    return {
      ok: false,
      error: 'INVALID_DATE_RANGE',
      status: 400,
      hint: 'Use from=YYYY-MM-DD&to=YYYY-MM-DD',
    }
  }
  const spanMs = toD.getTime() - fromD.getTime()
  if (spanMs > PARTNER_FINANCES_EXPORT_MAX_RANGE_DAYS * 86400000) {
    return {
      ok: false,
      error: 'RANGE_TOO_LARGE',
      status: 400,
      maxDays: PARTNER_FINANCES_EXPORT_MAX_RANGE_DAYS,
    }
  }
  const format = String(raw.format || 'csv')
    .trim()
    .toLowerCase()
  if (format !== 'csv' && format !== 'pdf') {
    return { ok: false, error: 'INVALID_FORMAT', status: 400, hint: 'format=csv|pdf' }
  }
  const axis = resolvePartnerFinancesExportAxis(raw.axis)
  if (!axis) {
    return { ok: false, error: 'INVALID_AXIS', status: 400, hint: 'axis=created|checkout' }
  }
  return { ok: true, fromYmd, toYmd, format, axis }
}

/**
 * @param {{ fromYmd: string, toYmd: string, format: 'csv'|'pdf' }} opts
 */
export function buildPartnerFinancesExportFilename({ fromYmd, toYmd, format }) {
  const ext = format === 'pdf' ? 'pdf' : 'csv'
  return `${getSiteBrandSlug()}-finances-statement-${fromYmd}-${toYmd}.${ext}`
}

export function csvEscapeCell(value) {
  const s = value == null ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function isoDateOnly(value) {
  if (!value) return ''
  const s = String(value)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export function listingTitleFromRow(row) {
  const listing = row?.listing
  if (Array.isArray(listing)) return String(listing[0]?.title || '').trim()
  if (listing && typeof listing === 'object') return String(listing.title || '').trim()
  return ''
}

/**
 * @param {string[][]} dataRows cells already stringified
 * @returns {string} UTF-8 CSV with BOM for Excel
 */
export function joinPartnerFinancesCsv(dataRows) {
  const lines = [PARTNER_FINANCES_CSV_HEADERS.map(csvEscapeCell).join(',')]
  for (const cells of dataRows) {
    lines.push(cells.map(csvEscapeCell).join(','))
  }
  return `${UTF8_BOM}${lines.join('\n')}`
}
