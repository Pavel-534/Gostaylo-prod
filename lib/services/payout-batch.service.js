/**
 * Mass payout batches (Mon/Thu pools) — Stage 97.0.5
 * @see database/migrations/053_financial_model_v2.sql
 */

import { supabaseAdmin } from '@/lib/supabase'
import { createHash } from 'crypto'
import {
  isEligibleForReadyForPayoutStatus,
  isBookingDisputePaymentFrozen,
} from '@/lib/partner/partner-payout-eligibility.js'
import DisputeService from '@/lib/services/dispute.service.js'

const BATCH_STATUSES = ['DRAFT', 'LOCKED', 'EXPORTED', 'SETTLED', 'FAILED', 'CANCELLED']

function round2(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.round(x * 100) / 100
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

/** Mon=1, Thu=4 (local server TZ) */
export function isScheduledPayoutPoolDay(date = new Date()) {
  const dow = date.getDay()
  return dow === 1 || dow === 4
}

function newBatchId(prefix = 'pb') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export class PayoutBatchService {
  /**
   * THAWED → READY_FOR_PAYOUT after 24h hold (partner withdrawable window passed).
   */
  static async promoteThawedToReadyForPayout(limit = 500) {
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
      const meta =
        b.metadata && typeof b.metadata === 'object' ? { ...b.metadata } : {}
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
   * @param {{ rail?: string, scheduledFor?: string, createdBy?: string, force?: boolean }} opts
   */
  static async createDraftPoolForToday(opts = {}) {
    if (!supabaseAdmin) return { error: 'no_db' }
    const scheduledFor = opts.scheduledFor || todayIsoDate()
    if (!opts.force && !isScheduledPayoutPoolDay(new Date(`${scheduledFor}T12:00:00`))) {
      return {
        error: 'not_pool_day',
        message: 'Payout pools are scheduled Mon/Thu only (use force=true to override)',
      }
    }

    await this.promoteThawedToReadyForPayout()

    const rail = String(opts.rail || 'TBANK_RU').toUpperCase()
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

    const frozenSet = await DisputeService.getFrozenBookingIdSet((bookings || []).map((b) => b.id))
    const poolBookings = (bookings || []).filter((b) => !isBookingDisputePaymentFrozen(b, frozenSet))
    const bookingIds = poolBookings.map((b) => b.id)
    if (!bookingIds.length) {
      return { batchId: null, itemCount: 0, message: 'no_ready_bookings' }
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
    const items = eligible.map((b) => {
      const amount = round2(b.partner_earnings_thb)
      totalsThb += amount
      return {
        id: `pbi-${batchId}-${b.id}`.slice(0, 120),
        batch_id: batchId,
        booking_id: b.id,
        partner_id: b.partner_id,
        amount_thb: amount,
        payout_currency: b.listing_currency || 'THB',
        status: 'PENDING',
        metadata: { booking_status: b.status },
      }
    })

    const { error: batchErr } = await supabaseAdmin.from('payout_batches').insert({
      id: batchId,
      status: 'DRAFT',
      rail,
      scheduled_for: scheduledFor,
      totals_thb: round2(totalsThb),
      item_count: items.length,
      created_by: opts.createdBy || null,
      metadata: { source: 'admin_or_cron', stage: '97.0.5' },
    })
    if (batchErr) return { error: batchErr.message }

    const { error: itemsErr } = await supabaseAdmin.from('payout_batch_items').insert(items)
    if (itemsErr) {
      await supabaseAdmin.from('payout_batches').delete().eq('id', batchId)
      return { error: itemsErr.message }
    }

    return { batchId, itemCount: items.length, totalsThb: round2(totalsThb), rail }
  }

  static async listBatches({ limit = 50, status = null } = {}) {
    let q = supabaseAdmin.from('payout_batches').select('*').order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data, error } = await q.limit(limit)
    if (error) throw new Error(error.message)
    return data || []
  }

  static async getBatchWithItems(batchId) {
    const { data: batch, error } = await supabaseAdmin
      .from('payout_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!batch) return null
    const { data: items } = await supabaseAdmin
      .from('payout_batch_items')
      .select('*')
      .eq('batch_id', batchId)
    return { batch, items: items || [] }
  }

  static async lockBatch(batchId, userId = null) {
    const { data: batch } = await supabaseAdmin
      .from('payout_batches')
      .select('id, status')
      .eq('id', batchId)
      .maybeSingle()
    if (!batch) return { error: 'not_found' }
    if (batch.status !== 'DRAFT') return { error: 'invalid_status', status: batch.status }

    const now = new Date().toISOString()
    await supabaseAdmin
      .from('payout_batches')
      .update({ status: 'LOCKED', locked_at: now, updated_at: now })
      .eq('id', batchId)
    await supabaseAdmin
      .from('payout_batch_items')
      .update({ status: 'LOCKED', updated_at: now })
      .eq('batch_id', batchId)
      .eq('status', 'PENDING')

    return { success: true, batchId, lockedBy: userId }
  }

  /**
   * @param {string} batchId
   * @param {'json' | 'csv'} format
   */
  static async exportBatchRegistry(batchId, format = 'json') {
    const pack = await this.getBatchWithItems(batchId)
    if (!pack?.batch) return { error: 'not_found' }

    const rows = (pack.items || []).map((item) => ({
      batch_id: batchId,
      booking_id: item.booking_id,
      partner_id: item.partner_id,
      amount_thb: item.amount_thb,
      amount_rub: item.amount_rub,
      payout_currency: item.payout_currency,
      status: item.status,
    }))

    const payload = {
      batch: pack.batch,
      exported_at: new Date().toISOString(),
      items: rows,
    }
    const body =
      format === 'csv' ? this.registryToCsv(rows) : JSON.stringify(payload, null, 2)
    const checksum = createHash('sha256').update(body).digest('hex')

    if (pack.batch.status === 'LOCKED') {
      const now = new Date().toISOString()
      await supabaseAdmin
        .from('payout_batches')
        .update({
          status: 'EXPORTED',
          exported_at: now,
          export_checksum: checksum,
          updated_at: now,
          metadata: {
            ...(pack.batch.metadata || {}),
            last_export_format: format,
          },
        })
        .eq('id', batchId)
      await supabaseAdmin
        .from('payout_batch_items')
        .update({ status: 'EXPORTED', updated_at: now })
        .eq('batch_id', batchId)
        .in('status', ['LOCKED', 'PENDING'])
    }

    return { body, checksum, contentType: format === 'csv' ? 'text/csv' : 'application/json', payload }
  }

  static registryToCsv(rows) {
    const header = ['batch_id', 'booking_id', 'partner_id', 'amount_thb', 'amount_rub', 'payout_currency', 'status']
    const lines = [header.join(',')]
    for (const r of rows) {
      lines.push(
        [
          r.batch_id,
          r.booking_id,
          r.partner_id,
          r.amount_thb,
          r.amount_rub ?? '',
          r.payout_currency ?? '',
          r.status,
        ]
          .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
    }
    return lines.join('\n')
  }

  static async markBatchSettled(batchId) {
    const now = new Date().toISOString()
    await supabaseAdmin
      .from('payout_batches')
      .update({ status: 'SETTLED', settled_at: now, updated_at: now })
      .eq('id', batchId)
    await supabaseAdmin
      .from('payout_batch_items')
      .update({ status: 'SETTLED', updated_at: now })
      .eq('batch_id', batchId)
    return { success: true }
  }
}

export default PayoutBatchService
