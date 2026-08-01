/**
 * ADR-203 Phase 1 — partner cash derived from ledger (shadow only).
 * Does NOT replace getPartnerBalance / payout eligibility (status SoT stays).
 *
 * Bucket model (Phase 1): mirror status SoT buckets using ledger capture amounts,
 * so daily zeroDrift is meaningful while dual-SSOT is interim.
 * `accountNetThb` remains the true PARTNER_EARNINGS books position (includes settlements/holds).
 */

import { supabaseAdmin } from '@/lib/supabase'
import { partnerAccountId, round2 } from '@/lib/services/ledger/ledger-shared.js'

const CAPTURE_EVENTS = new Set(['BOOKING_PAYMENT_CAPTURED'])
const PAYOUT_EVENTS = new Set(['PARTNER_PAYOUT_OBLIGATION_SETTLED'])
const REFUND_EVENTS = new Set(['BOOKING_REFUND_PARTIAL'])
const HOLD_DEBIT_EVENTS = new Set(['DISPUTE_PARTNER_FUNDS_HELD'])
const HOLD_CREDIT_EVENTS = new Set([
  'DISPUTE_PARTNER_FUNDS_RELEASED',
  'DISPUTE_SPLIT_HOLD_SETTLED',
  'DISPUTE_REFUND_HOLD_SETTLED',
])
/** Match status SoT escrow bucket (`getPartnerBalance` frozen = PAID_ESCROW + CHECKED_IN). */
const FROZEN_BOOKING_STATUSES = new Set(['PAID_ESCROW', 'CHECKED_IN'])
/** Match status SoT available buckets (before thaw-hold / dispute / pending reserve). */
const AVAILABLE_BOOKING_STATUSES = new Set(['THAWED', 'READY_FOR_PAYOUT'])

const CHUNK = 150
const ENTRY_PAGE = 1000

/**
 * @param {string | Date | null | undefined} asOfDate
 * @returns {string | null}
 */
function normalizeAsOfIso(asOfDate) {
  if (asOfDate == null || asOfDate === '') return null
  if (asOfDate instanceof Date) {
    return Number.isFinite(asOfDate.getTime()) ? asOfDate.toISOString() : null
  }
  const raw = String(asOfDate).trim()
  if (!raw) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return `${raw}T23:59:59.999Z`
  }
  const t = Date.parse(raw)
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

function emptyResult(extra = {}) {
  return {
    success: false,
    availableThb: 0,
    frozenThb: 0,
    totalThb: 0,
    earningsThb: 0,
    payoutsThb: 0,
    holdsThb: 0,
    refundsThb: 0,
    accountNetThb: 0,
    asOf: null,
    accountId: null,
    ...extra,
  }
}

/**
 * @param {string} accountId
 */
async function fetchAllPartnerEntries(accountId) {
  const rows = []
  let from = 0
  for (;;) {
    const { data, error } = await supabaseAdmin
      .from('ledger_entries')
      .select('id, amount_thb, side, journal_id')
      .eq('account_id', accountId)
      .order('id', { ascending: true })
      .range(from, from + ENTRY_PAGE - 1)
    if (error) throw new Error(error.message)
    const batch = data || []
    rows.push(...batch)
    if (batch.length < ENTRY_PAGE) break
    from += ENTRY_PAGE
  }
  return rows
}

/**
 * @param {string[]} journalIds
 */
async function fetchJournalsByIds(journalIds) {
  /** @type {Map<string, { id: string, event_type: string, booking_id: string | null, created_at: string, metadata: object | null }>} */
  const map = new Map()
  for (let i = 0; i < journalIds.length; i += CHUNK) {
    const part = journalIds.slice(i, i + CHUNK)
    if (!part.length) continue
    const { data, error } = await supabaseAdmin
      .from('ledger_journals')
      .select('id, event_type, booking_id, created_at, metadata')
      .in('id', part)
    if (error) throw new Error(error.message)
    for (const j of data || []) {
      map.set(String(j.id), j)
    }
  }
  return map
}

/**
 * Shadow partner balance from ledger postings.
 *
 * Phase 1 (ADR-203): available/frozen mirror status buckets using capture (− refund) amounts.
 * Settlements reduce `accountNetThb` / `payoutsThb` but do **not** reduce shadow available
 * until the booking leaves THAWED/READY (same as status SoT). Compare layer may still subtract
 * pending payout reserve for fair delta.
 *
 * @param {string} partnerId
 * @param {{ asOfDate?: string | Date | null }} [opts]
 */
export async function getPartnerBalanceFromLedger(partnerId, opts = {}) {
  const pid = String(partnerId || '').trim()
  const asOfIso = normalizeAsOfIso(opts.asOfDate)
  if (!pid) return emptyResult({ error: 'missing_partner_id', asOf: asOfIso })
  if (!supabaseAdmin) return emptyResult({ error: 'no_db', asOf: asOfIso })

  const accountId = partnerAccountId(pid)

  try {
    const { data: accountRow } = await supabaseAdmin
      .from('ledger_accounts')
      .select('id')
      .eq('id', accountId)
      .maybeSingle()

    if (!accountRow?.id) {
      return {
        success: true,
        availableThb: 0,
        frozenThb: 0,
        totalThb: 0,
        earningsThb: 0,
        payoutsThb: 0,
        holdsThb: 0,
        refundsThb: 0,
        accountNetThb: 0,
        asOf: asOfIso,
        accountId,
      }
    }

    const entries = await fetchAllPartnerEntries(accountId)
    const journalIds = [...new Set(entries.map((e) => e.journal_id).filter(Boolean).map(String))]
    const journals = await fetchJournalsByIds(journalIds)

    let earningsThb = 0
    let payoutsThb = 0
    let refundsThb = 0
    let holdsThb = 0
    let accountNetThb = 0
    /** @type {Map<string, number>} */
    const captureByBooking = new Map()
    /** @type {Map<string, number>} */
    const refundByBooking = new Map()

    for (const row of entries) {
      const journal = journals.get(String(row.journal_id))
      if (!journal) continue
      if (asOfIso && String(journal.created_at || '') > asOfIso) continue

      const amt = round2(row.amount_thb)
      const side = String(row.side || '').toUpperCase()
      const eventType = String(journal.event_type || '')
      const bookingId = journal.booking_id ? String(journal.booking_id) : null

      if (side === 'CREDIT') accountNetThb = round2(accountNetThb + amt)
      else if (side === 'DEBIT') accountNetThb = round2(accountNetThb - amt)

      if (CAPTURE_EVENTS.has(eventType) && side === 'CREDIT') {
        earningsThb = round2(earningsThb + amt)
        if (bookingId) {
          captureByBooking.set(bookingId, round2((captureByBooking.get(bookingId) || 0) + amt))
        }
      } else if (PAYOUT_EVENTS.has(eventType) && side === 'DEBIT') {
        payoutsThb = round2(payoutsThb + amt)
      } else if (REFUND_EVENTS.has(eventType) && side === 'DEBIT') {
        refundsThb = round2(refundsThb + amt)
        if (bookingId) {
          refundByBooking.set(bookingId, round2((refundByBooking.get(bookingId) || 0) + amt))
        }
      } else if (HOLD_DEBIT_EVENTS.has(eventType) && side === 'DEBIT') {
        holdsThb = round2(holdsThb + amt)
      } else if (HOLD_CREDIT_EVENTS.has(eventType) && side === 'CREDIT') {
        holdsThb = round2(holdsThb - amt)
      }
    }

    holdsThb = round2(Math.max(0, holdsThb))

    const bookingIds = [...new Set([...captureByBooking.keys(), ...refundByBooking.keys()])]
    /** @type {Map<string, string>} */
    const statusById = new Map()
    for (let i = 0; i < bookingIds.length; i += CHUNK) {
      const chunk = bookingIds.slice(i, i + CHUNK)
      const { data: bookings, error: bErr } = await supabaseAdmin
        .from('bookings')
        .select('id, status')
        .in('id', chunk)
      if (bErr) throw new Error(bErr.message)
      for (const b of bookings || []) {
        statusById.set(String(b.id), String(b.status || '').toUpperCase())
      }
    }

    let frozenThb = 0
    let availableGrossThb = 0
    for (const bookingId of bookingIds) {
      const st = statusById.get(bookingId) || ''
      const net = round2((captureByBooking.get(bookingId) || 0) - (refundByBooking.get(bookingId) || 0))
      if (net <= 0) continue
      if (FROZEN_BOOKING_STATUSES.has(st)) frozenThb = round2(frozenThb + net)
      else if (AVAILABLE_BOOKING_STATUSES.has(st)) availableGrossThb = round2(availableGrossThb + net)
    }

    // Phase 1: do not subtract settlements/holds from available/frozen (status SoT does not either
    // until booking leaves the bucket). Holds/thaw-hold/dispute still cause explainable drift vs status.
    const availableThb = round2(Math.max(0, availableGrossThb))
    const totalThb = round2(frozenThb + availableThb)

    return {
      success: true,
      availableThb,
      frozenThb,
      totalThb,
      earningsThb,
      payoutsThb,
      holdsThb,
      refundsThb,
      accountNetThb,
      asOf: asOfIso,
      accountId,
    }
  } catch (e) {
    return emptyResult({
      error: e?.message || String(e),
      asOf: asOfIso,
      accountId,
    })
  }
}
