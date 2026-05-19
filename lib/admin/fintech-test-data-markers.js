/**
 * Stage 106.4 — маркеры тестовых / smoke / E2E сущностей в FinTech-пульте.
 */

import { E2E_TEST_DATA_TAG, isMarkedE2eTestData } from '@/lib/e2e/test-data-tag'
import { isTestListingId } from '@/lib/e2e/test-listing-cleanup'

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
  return TEST_ID_PATTERNS.some((re) => re.test(s))
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestBookingRow(row) {
  if (!row || typeof row !== 'object') return false
  if (isMarkedE2eTestData(row)) return true
  if (isTestListingId(row.listing_id)) return true
  if (isFintechTestEntityId(row.id)) return true
  if (isFintechTestEntityId(row.listing_id)) return true
  if (isFintechTestEntityId(row.renter_id)) return true
  if (isFintechTestEntityId(row.partner_id)) return true
  if (matchesFintechTestText(row.special_requests)) return true
  if (matchesFintechTestText(row.guest_name)) return true
  if (matchesFintechTestText(row.guest_email)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} batch
 * @param {{ allItemsTest?: boolean }} [opts]
 */
export function isFintechTestPayoutBatchRow(batch, opts = {}) {
  if (!batch || typeof batch !== 'object') return false
  if (isFintechTestEntityId(batch.id)) return true
  if (opts.allItemsTest === true) return true
  if (matchesFintechTestText(JSON.stringify(batch.metadata || {}))) return true
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
  if (matchesFintechTestText(row.first_name) || matchesFintechTestText(row.full_name)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestPayoutRow(row) {
  if (!row || typeof row !== 'object') return false
  if (matchesFintechTestText(row.notes)) return true
  if (isFintechTestEntityId(row.partner_id)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestLedgerJournalRow(row) {
  if (!row || typeof row !== 'object') return false
  if (isFintechTestEntityId(row.booking_id)) return true
  if (matchesFintechTestText(row.idempotency_key)) return true
  if (matchesFintechTestText(JSON.stringify(row.metadata || {}))) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestLedgerEntryRow(row) {
  if (!row || typeof row !== 'object') return false
  if (matchesFintechTestText(row.description)) return true
  const meta = row.metadata
  if (meta && typeof meta === 'object' && isFintechTestEntityId(meta.booking_id)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestConversionRow(row) {
  if (!row || typeof row !== 'object') return false
  if (matchesFintechTestText(row.description)) return true
  if (matchesFintechTestText(JSON.stringify(row.metadata || {}))) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isFintechTestMovementRow(row) {
  if (!row || typeof row !== 'object') return false
  if (matchesFintechTestText(row.title)) return true
  if (matchesFintechTestText(row.subtitle)) return true
  if (matchesFintechTestText(row.ref)) return true
  if (isFintechTestEntityId(row.bookingId)) return true
  if (isFintechTestEntityId(row.batchId)) return true
  return false
}
