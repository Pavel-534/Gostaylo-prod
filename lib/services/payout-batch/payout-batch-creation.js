/**
 * Stage 109.2 — payout batch creation, listing, lock.
 */
import { supabaseAdmin } from '@/lib/supabase'
import {
  isEligibleForReadyForPayoutStatus,
  isBookingDisputePaymentFrozen,
} from '@/lib/partner/partner-payout-eligibility.js'
import DisputeService from '@/lib/services/dispute.service.js'
import { listPartnerIdsWithOpenPayoutRequests, convertThbToPayoutCurrency } from '@/lib/partner/partner-payout-fx.js'
import {
  getPayoutRailMeta,
  normalizePayoutRail,
  partnerCurrencyMatchesRail,
} from '@/lib/treasury/payout-rails.js'
import {
  getBatchWithItems,
  isScheduledPayoutPoolDay,
  newBatchId,
  OPEN_PARTNER_PAYOUT_STATUSES,
  round2,
  todayIsoDate,
} from '@/lib/services/payout-batch/payout-batch-shared.js'

export { getBatchWithItems }

/**
 * THAWED → READY_FOR_PAYOUT after 24h hold (partner withdrawable window passed).
 */
export async function promoteThawedToReadyForPayout(limit = 500) {
  if (!supabaseAdmin) return { promoted: 0, skipped_hold: 0, error: 'no_db' }

  const { data: thawed, error } = await supabaseAdmin
    .from('bookings')
    .select('id, partner_id, partner_earnings_thb, status, metadata')
    .eq('status', 'THAWED')
    .gt('partner_earnings_thb', 0)
    .limit(limit)

  if (error) return { promoted: 0, error: error.message }
  if (!thawed?.length) return { promoted: 0, skipped_hold: 0 }

  const frozenSet = await DisputeService.getFrozenBookingIdSet(thawed.map((b) => b.id))
  const nowMs = Date.now()
  const eligible = thawed.filter((b) => isEligibleForReadyForPayoutStatus(b, nowMs, frozenSet))
  const skippedHold = thawed.length - eligible.length

  const ids = eligible.map((b) => b.id)
  if (!ids.length) return { promoted: 0, skipped_hold: skippedHold }

  const { data: batched } = await supabaseAdmin
    .from('payout_batch_items')
    .select('booking_id')
    .in('booking_id', ids)

  const inBatch = new Set((batched || []).map((r) => r.booking_id))
  let promoted = 0
  for (const b of eligible) {
    if (inBatch.has(b.id)) continue
    const meta = b.metadata && typeof b.metadata === 'object' ? { ...b.metadata } : {}
    const { error: upErr } = await supabaseAdmin
      .from('bookings')
      .update({
        status: 'READY_FOR_PAYOUT',
        updated_at: new Date().toISOString(),
        metadata: {
          ...meta,
          ready_for_payout_at: new Date().toISOString(),
        },
      })
      .eq('id', b.id)
      .eq('status', 'THAWED')
    if (!upErr) promoted += 1
  }
  return { promoted, skipped_hold: skippedHold }
}

/**
 * @param {{ rail?: string, scheduledFor?: string, createdBy?: string, force?: boolean, fromCron?: boolean }} opts
 */
export async function createDraftPoolForToday(opts = {}) {
  if (!supabaseAdmin) return { error: 'no_db' }

  const { assertTreasuryOpsAllowed } = await import('@/lib/treasury/treasury-ops-config.js')
  const gateAction = opts.fromCron ? 'auto_pool' : 'payout'
  const gate = await assertTreasuryOpsAllowed(gateAction)
  if (!gate.allowed) {
    return { error: gate.code, message: gate.message }
  }
  const scheduledFor = opts.scheduledFor || todayIsoDate()
  if (!opts.force && !isScheduledPayoutPoolDay(new Date(`${scheduledFor}T12:00:00`))) {
    return {
      error: 'not_pool_day',
      message: 'Payout pools are scheduled Mon/Thu only (use force=true to override)',
    }
  }

  await promoteThawedToReadyForPayout()

  const rail = normalizePayoutRail(opts.rail || 'TBANK_RU')
  const railMeta = getPayoutRailMeta(rail)
  const batchId = newBatchId('pb')

  const { data: bookings, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select(
      'id, partner_id, partner_earnings_thb, listing_currency, price_thb, pricing_snapshot, status',
    )
    .eq('status', 'READY_FOR_PAYOUT')
    .gt('partner_earnings_thb', 0)
    .limit(2000)

  if (bErr) return { error: bErr.message }

  const partnerIds = [...new Set((bookings || []).map((b) => b.partner_id).filter(Boolean))]
  const currencyByPartner = new Map()
  if (partnerIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, preferred_payout_currency, preferred_currency')
      .in('id', partnerIds)
    for (const p of profiles || []) {
      currencyByPartner.set(
        p.id,
        p.preferred_payout_currency || p.preferred_currency || 'THB',
      )
    }
  }

  const frozenSet = await DisputeService.getFrozenBookingIdSet((bookings || []).map((b) => b.id))
  const partnersWithOpenPayout = await listPartnerIdsWithOpenPayoutRequests(supabaseAdmin)
  const poolBookings = (bookings || []).filter((b) => {
    if (isBookingDisputePaymentFrozen(b, frozenSet)) return false
    if (partnersWithOpenPayout.has(b.partner_id)) return false
    const cur = currencyByPartner.get(b.partner_id) || 'THB'
    return partnerCurrencyMatchesRail(rail, cur)
  })
  const bookingIds = poolBookings.map((b) => b.id)
  if (!bookingIds.length) {
    return {
      batchId: null,
      itemCount: 0,
      message: 'no_ready_bookings',
      rail,
      railLabel: railMeta.ownerLabel,
    }
  }

  const { data: existingItems } = await supabaseAdmin
    .from('payout_batch_items')
    .select('booking_id')
    .in('booking_id', bookingIds)

  const taken = new Set((existingItems || []).map((i) => i.booking_id))
  const eligible = poolBookings.filter((b) => !taken.has(b.id))
  if (!eligible.length) {
    return { batchId: null, itemCount: 0, message: 'all_already_batched' }
  }

  let totalsThb = 0
  const items = []
  for (const b of eligible) {
    const amount = round2(b.partner_earnings_thb)
    totalsThb += amount
    const item = {
      id: `pbi-${batchId}-${b.id}`.slice(0, 120),
      batch_id: batchId,
      booking_id: b.id,
      partner_id: b.partner_id,
      amount_thb: amount,
      payout_currency: 'THB',
      status: 'PENDING',
      metadata: { booking_status: b.status },
    }
    const partnerCur = currencyByPartner.get(b.partner_id) || 'THB'
    item.metadata = {
      booking_status: b.status,
      payout_rail: rail,
      partner_preferred_payout_currency: partnerCur,
    }
    try {
      if (rail === 'TBANK_RU') {
        const fx = await convertThbToPayoutCurrency(amount, 'RUB', 'pm-bank-ru')
        item.payout_currency = fx.payoutCurrency
        item.amount_in_payout_currency = fx.amountInPayoutCurrency
        item.amount_rub = fx.amountInPayoutCurrency
      } else if (rail === 'KG_CRYPTO') {
        const target = ['USDT', 'USD'].includes(String(partnerCur).toUpperCase())
          ? String(partnerCur).toUpperCase()
          : 'USDT'
        const fx = await convertThbToPayoutCurrency(amount, target, 'pm-crypto-usdt')
        item.payout_currency = fx.payoutCurrency
        item.amount_in_payout_currency = fx.amountInPayoutCurrency
      }
    } catch (e) {
      console.warn('[PAYOUT BATCH] FX skip booking', b.id, rail, e?.message)
    }
    items.push(item)
  }

  const { error: batchErr } = await supabaseAdmin.from('payout_batches').insert({
    id: batchId,
    status: 'DRAFT',
    rail,
    scheduled_for: scheduledFor,
    totals_thb: round2(totalsThb),
    item_count: items.length,
    created_by: opts.createdBy || null,
    metadata: {
      source: 'admin_or_cron',
      stage: '104.0',
      payout_rail_label: railMeta.ownerLabel,
    },
  })
  if (batchErr) return { error: batchErr.message }

  const { error: itemsErr } = await supabaseAdmin.from('payout_batch_items').insert(items)
  if (itemsErr) {
    await supabaseAdmin.from('payout_batches').delete().eq('id', batchId)
    return { error: itemsErr.message }
  }

  return {
    batchId,
    itemCount: items.length,
    totalsThb: round2(totalsThb),
    rail,
    railLabel: railMeta.ownerLabel,
  }
}

export async function listBatches({ limit = 50, status = null } = {}) {
  let q = supabaseAdmin.from('payout_batches').select('*').order('created_at', { ascending: false })
  if (status) q = q.eq('status', status)
  const { data, error } = await q.limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}

/**
 * Admin list with settle guard metadata for LOCKED/EXPORTED pools.
 */
export async function listBatchesForAdmin({ limit = 50, status = null } = {}) {
  const batches = await listBatches({ limit, status })
  const activeIds = batches
    .filter((b) => ['LOCKED', 'EXPORTED'].includes(String(b.status || '').toUpperCase()))
    .map((b) => b.id)

  if (!activeIds.length) {
    return batches.map((b) => ({ ...b, settleBlockers: [], canSettle: false }))
  }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('payout_batch_items')
    .select('batch_id, partner_id')
    .in('batch_id', activeIds)

  if (itemsErr) throw new Error(itemsErr.message)

  const partnersByBatch = new Map()
  const allPartnerIds = new Set()
  for (const row of items || []) {
    if (!row.partner_id) continue
    allPartnerIds.add(row.partner_id)
    if (!partnersByBatch.has(row.batch_id)) partnersByBatch.set(row.batch_id, new Set())
    partnersByBatch.get(row.batch_id).add(row.partner_id)
  }

  const openByPartner = new Map()
  if (allPartnerIds.size) {
    const { data: openPayouts, error: openErr } = await supabaseAdmin
      .from('payouts')
      .select('id, partner_id, status, gross_amount, created_at')
      .in('partner_id', [...allPartnerIds])
      .in('status', OPEN_PARTNER_PAYOUT_STATUSES)

    if (openErr) throw new Error(openErr.message)

    for (const row of openPayouts || []) {
      if (!openByPartner.has(row.partner_id)) openByPartner.set(row.partner_id, [])
      openByPartner.get(row.partner_id).push({
        id: row.id,
        status: row.status,
        grossAmountThb: round2(row.gross_amount),
        createdAt: row.created_at,
      })
    }
  }

  return batches.map((batch) => {
    const st = String(batch.status || '').toUpperCase()
    if (!['LOCKED', 'EXPORTED'].includes(st)) {
      return { ...batch, settleBlockers: [], canSettle: false }
    }
    const partnerSet = partnersByBatch.get(batch.id) || new Set()
    const settleBlockers = []
    for (const partnerId of partnerSet) {
      const openRequests = openByPartner.get(partnerId) || []
      if (openRequests.length) settleBlockers.push({ partnerId, openRequests })
    }
    return {
      ...batch,
      settleBlockers,
      canSettle: settleBlockers.length === 0,
    }
  })
}

export async function lockBatch(batchId, userId = null) {
  const { data: batch } = await supabaseAdmin
    .from('payout_batches')
    .select('id, status')
    .eq('id', batchId)
    .maybeSingle()
  if (!batch) return { success: false, error: 'not_found' }

  const st = String(batch.status || '')
    .trim()
    .toUpperCase()
  if (st !== 'DRAFT') {
    return { success: false, error: 'invalid_status', status: batch.status }
  }

  const now = new Date().toISOString()
  const { error: batchUpErr } = await supabaseAdmin
    .from('payout_batches')
    .update({ status: 'LOCKED', locked_at: now, updated_at: now })
    .eq('id', batchId)
  if (batchUpErr) {
    return { success: false, error: batchUpErr.message, status: batch.status }
  }

  const { error: itemsUpErr } = await supabaseAdmin
    .from('payout_batch_items')
    .update({ status: 'LOCKED', updated_at: now })
    .eq('batch_id', batchId)
    .eq('status', 'PENDING')

  if (itemsUpErr) {
    return { success: false, error: itemsUpErr.message, status: batch.status }
  }

  const { data: refreshed } = await supabaseAdmin
    .from('payout_batches')
    .select('status')
    .eq('id', batchId)
    .maybeSingle()

  const after = String(refreshed?.status || '')
    .trim()
    .toUpperCase()
  if (after !== 'LOCKED') {
    return {
      success: false,
      error: 'lock_failed',
      message: `Ожидался статус LOCKED, в БД: ${refreshed?.status ?? 'null'}`,
      status: refreshed?.status,
    }
  }

  return { success: true, batchId, lockedBy: userId, status: 'LOCKED' }
}
