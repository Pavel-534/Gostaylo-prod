/**
 * SSOT: calendar_blocks.source values + partner calendar display kind (Stage 175.1 → 175.2).
 * All writers/readers of calendar_blocks.source must import from here — not string literals.
 */

/** @typedef {'MANUAL' | 'INVOICE_HOLD' | 'INQUIRY_HOLD' | 'ICAL' | 'INVENTORY'} BlockDisplayKind */

/** Partner manual block (maintenance / owner use). */
export const MANUAL_BLOCK_SOURCE = 'manual'

/** Chat invoice payment-window soft-hold. */
export const INVOICE_HOLD_SOURCE = 'invoice_hold'

/** Inquiry legacy marker — does not block availability since Stage 175.3. */
export const INQUIRY_HOLD_SOURCE = 'inquiry_hold'

/** @deprecated Use INQUIRY_HOLD_SOURCE — legacy alias from inquiry-soft-hold.js */
export const INQUIRY_SOFT_HOLD_SOURCE = INQUIRY_HOLD_SOURCE

export const BLOCK_DISPLAY_KIND = Object.freeze({
  MANUAL: 'MANUAL',
  INVOICE_HOLD: 'INVOICE_HOLD',
  INQUIRY_HOLD: 'INQUIRY_HOLD',
  ICAL: 'ICAL',
  INVENTORY: 'INVENTORY',
})

/**
 * Map DB `calendar_blocks.source` to partner grid `blockKind`.
 * @param {string | null | undefined} source
 * @returns {BlockDisplayKind}
 */
export function resolveBlockDisplayKind(source) {
  const raw = String(source ?? '').trim()
  if (!raw) return BLOCK_DISPLAY_KIND.MANUAL
  const src = raw.toLowerCase()
  if (src === MANUAL_BLOCK_SOURCE) return BLOCK_DISPLAY_KIND.MANUAL
  if (src === INVOICE_HOLD_SOURCE) return BLOCK_DISPLAY_KIND.INVOICE_HOLD
  if (src === INQUIRY_HOLD_SOURCE) return BLOCK_DISPLAY_KIND.INQUIRY_HOLD
  if (src.startsWith('http')) return BLOCK_DISPLAY_KIND.ICAL
  // Legacy iCal pipeline identifiers (non-manual, non-hold)
  return BLOCK_DISPLAY_KIND.ICAL
}

/**
 * @param {string | null | undefined} kind
 * @returns {boolean}
 */
export function isSoftHoldDisplayKind(kind) {
  return kind === BLOCK_DISPLAY_KIND.INVOICE_HOLD || kind === BLOCK_DISPLAY_KIND.INQUIRY_HOLD
}

/**
 * Stage 175.3 — inquiry chat requests must not reduce public/partner availability (first paid wins).
 * Legacy `inquiry_hold` rows may still exist; they are display-only, not inventory-blocking.
 * @param {string | null | undefined} source — `calendar_blocks.source`
 * @returns {boolean}
 */
export function countsTowardCalendarAvailability(source) {
  const kind = resolveBlockDisplayKind(source)
  return kind !== BLOCK_DISPLAY_KIND.INQUIRY_HOLD
}

/**
 * @param {{ expires_at?: string | null }} block
 * @param {number} [nowMs]
 */
export function isCalendarBlockExpired(block, nowMs = Date.now()) {
  if (!block?.expires_at) return false
  const t = new Date(block.expires_at).getTime()
  return Number.isFinite(t) && t <= nowMs
}

/**
 * Split partner listing blocks for wizard UI (do not dump holds into the iCal list).
 * @param {Array<{ source?: string, expires_at?: string | null }>} blocks
 * @param {number} [nowMs]
 */
export function partitionPartnerListingBlocks(blocks, nowMs = Date.now()) {
  const active = (Array.isArray(blocks) ? blocks : []).filter((b) => !isCalendarBlockExpired(b, nowMs))
  const manual = []
  const ical = []
  const holds = []
  for (const block of active) {
    const kind = resolveBlockDisplayKind(block.source)
    if (kind === BLOCK_DISPLAY_KIND.MANUAL) manual.push(block)
    else if (kind === BLOCK_DISPLAY_KIND.ICAL) ical.push(block)
    else if (isSoftHoldDisplayKind(kind)) holds.push(block)
  }
  return { manual, ical, holds }
}

/**
 * Partner «from import» summary: hide nights that already ended (listing YYYY-MM-DD).
 * @param {{ end_date?: string | null }} block
 * @param {string} todayYmd
 */
export function isCalendarBlockDateRangePast(block, todayYmd) {
  const end = String(block?.end_date || '').slice(0, 10)
  const today = String(todayYmd || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false
  return end < today
}

/**
 * Upcoming iCal busy only — not holds, not expired, not past nights.
 * @param {Array<{ source?: string, expires_at?: string | null, end_date?: string | null }>} blocks
 * @param {{ nowMs?: number, todayYmd?: string }} [opts]
 */
export function blocksForPartnerIcalImportSummary(blocks, opts = {}) {
  const nowMs = opts.nowMs ?? Date.now()
  const todayYmd = String(opts.todayYmd || '').slice(0, 10)
  const { ical } = partitionPartnerListingBlocks(blocks, nowMs)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(todayYmd)) return ical
  return ical.filter((block) => !isCalendarBlockDateRangePast(block, todayYmd))
}
