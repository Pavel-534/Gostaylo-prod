/**
 * Stage 117.4 — SSOT: маркеры тестовых записей referral / marketing tank / wallet (Node-safe).
 */

import { E2E_TEST_DATA_TAG } from './test-data-tag.js'
import { STAGE72_REUSE_LISTING_ID } from './test-listing-cleanup.js'
import { TEST_PROFILE_ID_PREFIXES } from './test-user-markers.js'

const TEST_BOOKING_ID_PREFIXES = ['bk-stage', 'bk-smoke', 'bk-e2e', 'bk-test']
const TEST_BOOKING_ID_SUBSTRINGS = ['stage72', 'stage103', 'stage104', 'financial-smoke']

/**
 * @param {string | null | undefined} id
 */
export function isTestProfileId(id) {
  const s = String(id || '').trim()
  if (!s) return false
  return TEST_PROFILE_ID_PREFIXES.some((p) => s.toLowerCase().startsWith(p.toLowerCase()))
}

/**
 * @param {string | null | undefined} id
 */
export function isTestBookingId(id) {
  const s = String(id || '').trim()
  if (!s) return false
  const low = s.toLowerCase()
  if (TEST_BOOKING_ID_PREFIXES.some((p) => low.startsWith(p))) return true
  return TEST_BOOKING_ID_SUBSTRINGS.some((sub) => low.includes(sub))
}

function haystackIncludesTestTag(...parts) {
  const hay = parts.filter(Boolean).join('\n')
  if (!hay) return false
  if (hay.includes(E2E_TEST_DATA_TAG)) return true
  if (/\bstage72\b/i.test(hay)) return true
  if (/\bstage10[34]\b/i.test(hay)) return true
  if (/\bfinancial-smoke\b/i.test(hay)) return true
  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isTestBookingRow(row) {
  if (!row || typeof row !== 'object') return false
  if (isTestBookingId(row.id)) return true
  if (String(row.listing_id || '') === STAGE72_REUSE_LISTING_ID) return true

  const email = String(row.guest_email || row.guestEmail || '').toLowerCase()
  if (email.endsWith('@test.gostaylo.invalid') || email.endsWith('@smoke.invalid')) return true
  if (email.includes('user-smoke') || email.includes('user-s72')) return true

  if (isTestProfileId(row.renter_id) || isTestProfileId(row.partner_id)) return true

  return haystackIncludesTestTag(row.guest_name, row.guestName, row.special_requests, row.specialRequests)
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isTestReferralLedgerRow(row) {
  if (!row || typeof row !== 'object') return false
  if (isTestBookingId(row.booking_id)) return true
  if (isTestProfileId(row.referrer_id) || isTestProfileId(row.referee_id)) return true
  return haystackIncludesTestTag(JSON.stringify(row.metadata || {}))
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isTestTankLedgerRow(row) {
  if (!row || typeof row !== 'object') return false
  if (isTestBookingId(row.booking_id)) return true

  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  if (String(meta.trigger || '') === 'e2e_completed') return true
  if (haystackIncludesTestTag(JSON.stringify(meta))) return true

  const profileRefs = [meta.referee_id, meta.host_partner_id, meta.referrer_id, meta.partner_id]
  if (profileRefs.some((id) => isTestProfileId(id))) return true

  const bookingRef = meta.booking_id || meta.bookingId
  if (isTestBookingId(bookingRef)) return true

  return false
}

/**
 * @param {Record<string, unknown> | null | undefined} row
 */
export function isTestWalletTransactionRow(row, opts = {}) {
  if (!row || typeof row !== 'object') return false
  if (isTestProfileId(row.user_id)) return true

  const ref = String(row.reference_id || '')
  if (ref.startsWith('referral_ledger:')) {
    const ledgerId = ref.slice('referral_ledger:'.length).split(/[|:]/)[0]
    if (opts.testReferralLedgerIds?.has(ledgerId)) return true
  }

  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  if (haystackIncludesTestTag(JSON.stringify(meta), row.tx_type)) return true

  return false
}
