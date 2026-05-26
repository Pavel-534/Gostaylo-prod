/**
 * Stage 117.4 — агрессивная очистка referral_ledger, marketing_promo_tank_ledger, wallet_transactions.
 */

import { STAGE72_REUSE_LISTING_ID } from './test-listing-cleanup.js'
import { collectAggressiveTestProfileIds } from './cleanup-test-users.service.js'
import {
  isTestBookingRow,
  isTestReferralLedgerRow,
  isTestTankLedgerRow,
  isTestWalletTransactionRow,
} from './test-marketing-referral-markers.js'
const CHUNK = 150
const SCAN_LIMIT = 10000

function uniq(arr) {
  return [...new Set((arr || []).filter(Boolean).map((x) => String(x)))]
}

function chunks(arr, size = CHUNK) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function safeDeleteIn(sb, table, column, ids, label) {
  let deleted = 0
  for (const part of chunks(ids)) {
    if (!part.length) continue
    const { count, error } = await sb.from(table).delete({ count: 'exact' }).in(column, part)
    if (error && !String(error.message || '').includes('does not exist')) {
      console.warn(`[cleanup-marketing-referral] ${label || table}:`, error.message)
    } else if (typeof count === 'number') {
      deleted += count
    }
  }
  return deleted
}

async function queryAllRows(sb, table, cols, label, builder) {
  const rows = []
  let from = 0
  while (from < SCAN_LIMIT) {
    const { data, error } = await builder(sb.from(table).select(cols).range(from, from + 999))
    if (error) {
      console.warn(`[cleanup-marketing-referral] ${label}:`, error.message)
      break
    }
    const batch = data || []
    rows.push(...batch)
    if (batch.length < 1000) break
    from += 1000
  }
  return rows
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 */
export async function collectTestBookingIds(sb) {
  const ids = new Set()

  const ingest = (rows) => {
    for (const row of rows || []) {
      if (isTestBookingRow(row) && row?.id) ids.add(String(row.id))
    }
  }

  const cols =
    'id, listing_id, guest_email, guest_name, special_requests, renter_id, partner_id'

  ingest(
    await queryAllRows(sb, 'bookings', cols, 'bookings stage72 listing', (q) =>
      q.eq('listing_id', STAGE72_REUSE_LISTING_ID),
    ),
  )

  for (const pattern of ['%@test.gostaylo.invalid', '%@smoke.invalid', '%user-smoke%', '%user-s72%']) {
    const { data, error } = await sb.from('bookings').select(cols).ilike('guest_email', pattern)
    if (error) console.warn(`[cleanup-marketing-referral] bookings email ${pattern}:`, error.message)
    else ingest(data)
  }

  for (const pattern of ['%[E2E_TEST_DATA]%', '%stage72%', '%financial-smoke%']) {
    const { data: bySr, error: e1 } = await sb.from('bookings').select(cols).ilike('special_requests', pattern)
    if (e1) console.warn('[cleanup-marketing-referral] bookings special_requests:', e1.message)
    else ingest(bySr)
    const { data: byGn, error: e2 } = await sb.from('bookings').select(cols).ilike('guest_name', pattern)
    if (e2) console.warn('[cleanup-marketing-referral] bookings guest_name:', e2.message)
    else ingest(byGn)
  }

  const { profileIds } = await collectAggressiveTestProfileIds(sb)
  for (const part of chunks(profileIds)) {
    if (!part.length) continue
    const { data: br } = await sb.from('bookings').select(cols).in('renter_id', part)
    ingest(br)
    const { data: bp } = await sb.from('bookings').select(cols).in('partner_id', part)
    ingest(bp)
  }

  const recent = await queryAllRows(sb, 'bookings', cols, 'bookings recent', (q) =>
    q.order('created_at', { ascending: false }),
  )
  ingest(recent)

  return [...ids]
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ bookingIds?: string[], profileIds?: string[] }} [ctx]
 */
export async function collectTestMarketingReferralIds(sb, ctx = {}) {
  const bookingIds = new Set(ctx.bookingIds || [])
  if (!bookingIds.size) {
    for (const id of await collectTestBookingIds(sb)) bookingIds.add(id)
  }

  const profileIds = new Set(ctx.profileIds || [])
  if (!profileIds.size) {
    const { profileIds: p } = await collectAggressiveTestProfileIds(sb)
    for (const id of p) profileIds.add(id)
  }

  const referralLedgerIds = new Set()
  const tankLedgerIds = new Set()
  const walletTransactionIds = new Set()

  const refCols =
    'id, booking_id, referrer_id, referee_id, type, status, metadata, created_at'
  const tankCols = 'id, booking_id, entry_type, amount_thb, metadata, created_at'

  for (const part of chunks([...bookingIds])) {
    if (!part.length) continue
    const { data: rl } = await sb.from('referral_ledger').select(refCols).in('booking_id', part)
    for (const row of rl || []) {
      if (isTestReferralLedgerRow(row)) referralLedgerIds.add(String(row.id))
    }
    const { data: tl } = await sb.from('marketing_promo_tank_ledger').select(tankCols).in('booking_id', part)
    for (const row of tl || []) {
      if (isTestTankLedgerRow(row)) tankLedgerIds.add(String(row.id))
    }
  }

  for (const prefix of ['user-s72-', 'user-smoke-', 'user-x71-']) {
    const { data: rlRef } = await sb.from('referral_ledger').select(refCols).ilike('referrer_id', `${prefix}%`)
    for (const row of rlRef || []) {
      if (isTestReferralLedgerRow(row)) referralLedgerIds.add(String(row.id))
    }
    const { data: rlRee } = await sb.from('referral_ledger').select(refCols).ilike('referee_id', `${prefix}%`)
    for (const row of rlRee || []) {
      if (isTestReferralLedgerRow(row)) referralLedgerIds.add(String(row.id))
    }
  }

  const tankRows = await queryAllRows(sb, 'marketing_promo_tank_ledger', tankCols, 'tank scan', (q) =>
    q.order('created_at', { ascending: false }),
  )
  for (const row of tankRows) {
    if (isTestTankLedgerRow(row)) tankLedgerIds.add(String(row.id))
  }

  const refScan = await queryAllRows(sb, 'referral_ledger', refCols, 'referral scan', (q) =>
    q.order('created_at', { ascending: false }),
  )
  for (const row of refScan) {
    if (isTestReferralLedgerRow(row)) referralLedgerIds.add(String(row.id))
  }

  const walletCols = 'id, user_id, tx_type, reference_id, metadata, created_at'
  for (const part of chunks([...profileIds])) {
    if (!part.length) continue
    const { data } = await sb.from('wallet_transactions').select(walletCols).in('user_id', part)
    for (const row of data || []) {
      if (isTestWalletTransactionRow(row, { testReferralLedgerIds: referralLedgerIds })) {
        walletTransactionIds.add(String(row.id))
      }
    }
  }

  const { data: byPrefix } = await sb
    .from('wallet_transactions')
    .select(walletCols)
    .or(
      [
        'user_id.like.user-s72-%',
        'user_id.like.user-smoke-%',
        'user_id.like.user-x71-%',
        'reference_id.ilike.referral_ledger:%',
      ].join(','),
    )
    .limit(5000)
  for (const row of byPrefix || []) {
    if (isTestWalletTransactionRow(row, { testReferralLedgerIds: referralLedgerIds })) {
      walletTransactionIds.add(String(row.id))
    }
  }

  for (const ledgerId of referralLedgerIds) {
    const { data } = await sb
      .from('wallet_transactions')
      .select(walletCols)
      .ilike('reference_id', `referral_ledger:${ledgerId}%`)
    for (const row of data || []) walletTransactionIds.add(String(row.id))
  }

  return {
    bookingIds: [...bookingIds],
    profileIds: [...profileIds],
    referralLedgerIds: [...referralLedgerIds],
    tankLedgerIds: [...tankLedgerIds],
    walletTransactionIds: [...walletTransactionIds],
    marketingReferralCount:
      referralLedgerIds.size + tankLedgerIds.size + walletTransactionIds.size,
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {{ dryRun?: boolean, bookingIds?: string[], profileIds?: string[] }} [opts]
 */
export async function runCleanupTestMarketingReferral(sb, opts = {}) {
  const dryRun = opts.dryRun !== false
  const collected = await collectTestMarketingReferralIds(sb, opts)

  const report = {
    dryRun,
    ...collected,
    deleted: {
      wallet_transactions: 0,
      referral_ledger: 0,
      marketing_promo_tank_ledger: 0,
      referral_relations: 0,
      payout_batch_items: 0,
    },
  }

  if (dryRun) {
    return report
  }

  report.deleted.wallet_transactions = await safeDeleteIn(
    sb,
    'wallet_transactions',
    'id',
    collected.walletTransactionIds,
  )

  report.deleted.referral_ledger = await safeDeleteIn(
    sb,
    'referral_ledger',
    'id',
    collected.referralLedgerIds,
  )

  for (const part of chunks(collected.bookingIds)) {
    if (!part.length) continue
    report.deleted.referral_ledger += await safeDeleteIn(sb, 'referral_ledger', 'booking_id', part)
    report.deleted.marketing_promo_tank_ledger += await safeDeleteIn(
      sb,
      'marketing_promo_tank_ledger',
      'booking_id',
      part,
    )
    report.deleted.payout_batch_items += await safeDeleteIn(sb, 'payout_batch_items', 'booking_id', part)
  }

  report.deleted.marketing_promo_tank_ledger += await safeDeleteIn(
    sb,
    'marketing_promo_tank_ledger',
    'id',
    collected.tankLedgerIds,
  )

  for (const part of chunks(collected.profileIds)) {
    if (!part.length) continue
    report.deleted.referral_relations += await safeDeleteIn(sb, 'referral_relations', 'referrer_id', part)
    report.deleted.referral_relations += await safeDeleteIn(sb, 'referral_relations', 'referee_id', part)
  }

  return report
}
