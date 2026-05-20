/**
 * Stage 106.4–106.5 — маркеры тестовых / smoke / E2E сущностей в FinTech-пульте.
 */

import { E2E_TEST_DATA_TAG, isMarkedE2eTestData } from '@/lib/e2e/test-data-tag'
import { isTestListingId } from '@/lib/e2e/test-listing-cleanup'
import { hasFintechTestDataFlag } from '@/lib/admin/fintech-test-data-meta.js'

/** Подстроки для агрессивной очистки (Stage 106.5). */
export const AGGRESSIVE_MARKER_SUBSTRINGS = [
  'e2e_test_data',
  '[e2e_test_data]',
  'lst-stage',
  'user-smoke',
  'pb-stage',
  'lj-payout-settled',
  'lj-batch-settled',
  'stage104',
  'stage103',
  'financial-smoke',
  'smoke-stage',
  '@smoke.invalid',
]

const TEST_TEXT_PATTERNS = [
  E2E_TEST_DATA_TAG,
  'stage104-financial-smoke',
  'stage103-financial-smoke',
  'stage72-cashflow',
  'financial-smoke',
  'smoke-stage',
]

const TEST_ID_PATTERNS = [
  /^user-smoke-/i,
  /^lst-stage\d+/i,
  /^lst-test/i,
  /^pb-stage\d+/i,
  /^pbi-pb-stage/i,
]

/**
 * @param {string | null | undefined} s
 */
export function matchesAggressiveTestHaystack(s) {
  const hay = String(s ?? '').toLowerCase()
  if (!hay) return false
  if (AGGRESSIVE_MARKER_SUBSTRINGS.some((m) => hay.includes(m.toLowerCase()))) return true
  if (/\bsmoke\b/.test(hay)) return true
  if (hay.includes('stage') && (hay.includes('smoke') || hay.includes('test') || /stage\d{2,3}/.test(hay))) {
    return true
  }
  return matchesFintechTestText(s)
}

/**
 * @param {string | null | undefined} s
 */
export function matchesFintechTestText(s) {
  const hay = String(s ?? '')
  if (!hay) return false
  if (TEST_TEXT_PATTERNS.some((p) => hay.includes(p))) return true
  const low = hay.toLowerCase()
  if (/\bsmoke\b/.test(low) && (low.includes('stage') || low.includes('test'))) return true
  if (low.includes('e2e_test_data') || low.includes('[e2e')) return true
  return false
}

/**
 * @param {string | null | undefined} id
 */
export function isFintechTestEntityId(id) {
  const s = String(id || '').trim()
  if (!s) return false
  if (TEST_ID_PATTERNS.some((re) => re.test(s))) return true
  if (matchesAggressiveTestHaystack(s)) return true
  return false
}

/**
 * @param {string | null | undefined} journalId
 */
export function isAggressiveTestJournalId(journalId) {
  const s = String(journalId || '')
  if (!s) return false
  if (/^lj-payout-settled-/i.test(s)) return true
  if (/^lj-batch-settled-/i.test(s)) return true
  if (/^lj-refund-/i.test(s) && matchesAggressiveTestHaystack(s)) return true
  return matchesAggressiveTestHaystack(s)
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestBookingRow(row) {
  if (!row || typeof row !== 'object') return false
  if (hasFintechTestDataFlag(row)) return true
  if (isMarkedE2eTestData(row)) return true
  if (isTestListingId(row.listing_id)) return true
  if (isFintechTestEntityId(row.id)) return true
  if (isFintechTestEntityId(row.listing_id)) return true
  if (isFintechTestEntityId(row.renter_id)) return true
  if (isFintechTestEntityId(row.partner_id)) return true
  if (matchesAggressiveTestHaystack(row.special_requests)) return true
  if (matchesAggressiveTestHaystack(row.guest_name)) return true
  if (matchesAggressiveTestHaystack(row.guest_email)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} batch
 * @param {{ allItemsTest?: boolean, emptyTestPool?: boolean }} [opts]
 */
export function isFintechTestPayoutBatchRow(batch, opts = {}) {
  if (!batch || typeof batch !== 'object') return false
  if (hasFintechTestDataFlag(batch)) return true
  if (isFintechTestEntityId(batch.id)) return true
  if (opts.allItemsTest === true) return true
  if (opts.emptyTestPool === true) return true
  if (matchesAggressiveTestHaystack(JSON.stringify(batch.metadata || {}))) return true
  if (isFintechTestEntityId(batch.created_by)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestProfileRow(row) {
  if (!row || typeof row !== 'object') return false
  if (isFintechTestEntityId(row.id)) return true
  const email = String(row.email || '').toLowerCase()
  if (email.endsWith('@smoke.invalid')) return true
  if (matchesAggressiveTestHaystack(row.first_name) || matchesAggressiveTestHaystack(row.full_name)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestPayoutRow(row) {
  if (!row || typeof row !== 'object') return false
  if (matchesAggressiveTestHaystack(row.notes)) return true
  if (isFintechTestEntityId(row.partner_id)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestLedgerJournalRow(row) {
  if (!row || typeof row !== 'object') return false
  if (hasFintechTestDataFlag(row)) return true
  if (isAggressiveTestJournalId(row.id)) return true
  if (isFintechTestEntityId(row.booking_id)) return true
  if (matchesAggressiveTestHaystack(row.idempotency_key)) return true
  if (matchesAggressiveTestHaystack(JSON.stringify(row.metadata || {}))) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestLedgerEntryRow(row) {
  if (!row || typeof row !== 'object') return false
  if (hasFintechTestDataFlag(row)) return true
  if (matchesAggressiveTestHaystack(row.description)) return true
  if (matchesAggressiveTestHaystack(row.journal_id)) return true
  if (matchesAggressiveTestHaystack(row.external_tx_reference)) return true
  const meta = row.metadata
  if (meta && typeof meta === 'object') {
    if (hasFintechTestDataFlag(meta)) return true
    if (isFintechTestEntityId(meta.booking_id)) return true
    if (matchesAggressiveTestHaystack(JSON.stringify(meta))) return true
  }
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestConversionRow(row) {
  if (!row || typeof row !== 'object') return false
  if (hasFintechTestDataFlag(row)) return true
  if (matchesAggressiveTestHaystack(row.description)) return true
  if (matchesAggressiveTestHaystack(JSON.stringify(row.metadata || {}))) return true
  if (matchesAggressiveTestHaystack(row.journal_id)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} alert
 * @param {{ bookingIds?: Set<string>, profileIds?: Set<string> }} [ctx]
 */
export function isFintechTestTreasuryAlert(alert, ctx = {}) {
  if (!alert || typeof alert !== 'object') return false
  if (hasFintechTestDataFlag(alert)) return true
  if (hasFintechTestDataFlag(alert.meta)) return true
  if (matchesAggressiveTestHaystack(alert.title) || matchesAggressiveTestHaystack(alert.detail)) return true
  const bid = alert.meta?.bookingId || alert.meta?.booking_id
  if (bid && ctx.bookingIds?.has(String(bid))) return true
  const pid = alert.meta?.partnerId || alert.meta?.partner_id
  if (pid && ctx.profileIds?.has(String(pid))) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestCriticalSignalRow(row) {
  if (!row || typeof row !== 'object') return false
  if (hasFintechTestDataFlag(row)) return true
  if (matchesAggressiveTestHaystack(row.detail)) return true
  if (matchesAggressiveTestHaystack(row.signal_key)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestMovementRow(row) {
  if (!row || typeof row !== 'object') return false
  if (hasFintechTestDataFlag(row)) return true
  if (matchesAggressiveTestHaystack(row.title)) return true
  if (matchesAggressiveTestHaystack(row.subtitle)) return true
  if (matchesAggressiveTestHaystack(row.ref)) return true
  if (isFintechTestEntityId(row.bookingId)) return true
  if (isFintechTestEntityId(row.batchId)) return true
  return false
}
