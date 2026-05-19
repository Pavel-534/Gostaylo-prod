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
import LedgerService from '@/lib/services/ledger.service.js'
import { syncPartnerBalanceColumns } from '@/lib/services/escrow/balance.service.js'
import { BookingStatus } from '@/lib/services/escrow/constants.js'
import { listPartnerIdsWithOpenPayoutRequests, convertThbToPayoutCurrency } from '@/lib/partner/partner-payout-fx.js'
import {
  getPayoutRailMeta,
  normalizePayoutRail,
  partnerCurrencyMatchesRail,
} from '@/lib/treasury/payout-rails.js'
import { generateBatchPartnerSettlementDocuments } from '@/lib/services/payout-document.service.js'
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'

const BATCH_STATUSES = ['DRAFT', 'LOCKED', 'EXPORTED', 'SETTLED', 'FAILED', 'CANCELLED']
const OPEN_PARTNER_PAYOUT_STATUSES = ['PENDING', 'PROCESSING']

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

    await this.promoteThawedToReadyForPayout()

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

  static async listBatches({ limit = 50, status = null } = {}) {
    let q = supabaseAdmin.from('payout_batches').select('*').order('created_at', { ascending: false })
    if (status) q = q.eq('status', status)
    const { data, error } = await q.limit(limit)
    if (error) throw new Error(error.message)
    return data || []
  }

  /**
   * Block batch settle when partners in the pool have open manual payout requests (PENDING/PROCESSING).
   * @param {string} batchId
   */
  static async getBatchSettleBlockers(batchId) {
    const pack = await this.getBatchWithItems(batchId)
    if (!pack?.batch) return { canSettle: false, blockers: [{ code: 'not_found' }] }

    const partnerIds = [...new Set((pack.items || []).map((i) => i.partner_id).filter(Boolean))]
    if (!partnerIds.length) return { canSettle: true, blockers: [] }

    const { data: openPayouts, error } = await supabaseAdmin
      .from('payouts')
      .select('id, partner_id, status, gross_amount, created_at')
      .in('partner_id', partnerIds)
      .in('status', OPEN_PARTNER_PAYOUT_STATUSES)

    if (error) {
      return { canSettle: false, blockers: [{ code: 'db_error', message: error.message }] }
    }

    const byPartner = new Map()
    for (const row of openPayouts || []) {
      if (!byPartner.has(row.partner_id)) byPartner.set(row.partner_id, [])
      byPartner.get(row.partner_id).push({
        id: row.id,
        status: row.status,
        grossAmountThb: round2(row.gross_amount),
        createdAt: row.created_at,
      })
    }

    const blockers = []
    for (const [partnerId, openRequests] of byPartner) {
      blockers.push({ partnerId, openRequests })
    }

    return { canSettle: blockers.length === 0, blockers }
  }

  /**
   * Admin list with settle guard metadata for LOCKED/EXPORTED pools.
   */
  static async listBatchesForAdmin({ limit = 50, status = null } = {}) {
    const batches = await this.listBatches({ limit, status })
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
      amount_in_payout_currency: item.amount_in_payout_currency,
      payout_currency: item.payout_currency,
      payout_rail: pack.batch.rail || item.metadata?.payout_rail,
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

    const batchSt = String(pack.batch.status || '')
      .trim()
      .toUpperCase()
    if (batchSt === 'LOCKED') {
      const now = new Date().toISOString()
      const { error: exportUpErr } = await supabaseAdmin
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
      if (exportUpErr) {
        return { error: exportUpErr.message }
      }
      await supabaseAdmin
        .from('payout_batch_items')
        .update({ status: 'EXPORTED', updated_at: now })
        .eq('batch_id', batchId)
        .in('status', ['LOCKED', 'PENDING'])
    }

    return { body, checksum, contentType: format === 'csv' ? 'text/csv' : 'application/json', payload }
  }

  static registryToCsv(rows) {
    const header = [
      'batch_id',
      'booking_id',
      'partner_id',
      'amount_thb',
      'amount_rub',
      'amount_in_payout_currency',
      'payout_currency',
      'payout_rail',
      'status',
    ]
    const lines = [header.join(',')]
    for (const r of rows) {
      lines.push(
        [
          r.batch_id,
          r.booking_id,
          r.partner_id,
          r.amount_thb,
          r.amount_rub ?? '',
          r.amount_in_payout_currency ?? '',
          r.payout_currency ?? '',
          r.payout_rail ?? '',
          r.status,
        ]
          .map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
    }
    return lines.join('\n')
  }

  /**
   * Mark treasury batch paid: ledger debit per booking, booking → COMPLETED, sync partner balances.
   * @param {string} batchId
   * @param {string | null} [settledBy]
   */
  static async markBatchSettled(batchId, settledBy = null) {
    const { assertTreasuryOpsAllowed } = await import('@/lib/treasury/treasury-ops-config.js')
    const gate = await assertTreasuryOpsAllowed('payout')
    if (!gate.allowed) {
      return { success: false, error: gate.code, message: gate.message }
    }

    const pack = await this.getBatchWithItems(batchId)
    if (!pack?.batch) return { success: false, error: 'not_found' }

    const st = String(pack.batch.status || '')
      .trim()
      .toUpperCase()
    if (st === 'SETTLED') {
      return { success: true, alreadySettled: true, batchId }
    }
    if (!['LOCKED', 'EXPORTED'].includes(st)) {
      return {
        success: false,
        error: 'invalid_status',
        status: pack.batch.status,
        message:
          st === 'DRAFT'
            ? 'Сначала зафиксируйте пул (Lock), затем скачайте CSV и закройте после перевода в банк.'
            : `Пул в статусе «${pack.batch.status}» — закрытие недоступно.`,
      }
    }

    const settleGuard = await this.getBatchSettleBlockers(batchId)
    if (!settleGuard.canSettle) {
      return {
        success: false,
        error: 'open_partner_payout_requests',
        message:
          'Нельзя закрыть пул: у партнёров из пула есть открытые заявки на вывод (PENDING/PROCESSING). Сначала обработайте или отмените их.',
        settleBlockers: settleGuard.blockers,
      }
    }

    const now = new Date().toISOString()
    const partnerIds = new Set()
    let bookingsCompleted = 0
    let ledgerPosted = 0
    const ledgerErrors = []

    for (const item of pack.items || []) {
      const amountThb = round2(item.amount_thb)
      const partnerId = item.partner_id
      const bookingId = item.booking_id
      if (!bookingId || !(amountThb > 0)) continue

      const ledger = await LedgerService.postPartnerBatchBookingPayoutSettled({
        batchId,
        bookingId,
        partnerId,
        amountThb,
      })
      if (ledger.success) ledgerPosted += 1
      else if (!ledger.skipped) ledgerErrors.push({ bookingId, error: ledger.error })

      const { data: booking } = await supabaseAdmin
        .from('bookings')
        .select('id, status, metadata')
        .eq('id', bookingId)
        .maybeSingle()

      if (booking && ['READY_FOR_PAYOUT', 'THAWED'].includes(String(booking.status))) {
        const meta = booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
        const { error: upErr } = await supabaseAdmin
          .from('bookings')
          .update({
            status: BookingStatus.COMPLETED,
            completed_at: now,
            payout_at: now,
            updated_at: now,
            metadata: {
              ...meta,
              payout_batch_id: batchId,
              payout_batch_settled_at: now,
              payout_batch_settled_by: settledBy || null,
            },
          })
          .eq('id', bookingId)
        if (!upErr) bookingsCompleted += 1
      }

      if (partnerId) partnerIds.add(partnerId)
    }

    for (const pid of partnerIds) {
      try {
        await syncPartnerBalanceColumns(pid)
      } catch (e) {
        console.error('[PayoutBatch] syncPartnerBalanceColumns', pid, e)
      }
    }

    await supabaseAdmin
      .from('payout_batches')
      .update({
        status: 'SETTLED',
        settled_at: now,
        updated_at: now,
        metadata: {
          ...(pack.batch.metadata || {}),
          settled_by: settledBy || null,
          bookings_completed: bookingsCompleted,
          ledger_posted: ledgerPosted,
        },
      })
      .eq('id', batchId)
    await supabaseAdmin
      .from('payout_batch_items')
      .update({ status: 'SETTLED', updated_at: now })
      .eq('batch_id', batchId)

    let settlementDocuments = null
    try {
      settlementDocuments = await generateBatchPartnerSettlementDocuments(batchId, pack.items || [])
    } catch (docErr) {
      console.error('[PayoutBatch] settlement PDF', batchId, docErr)
    }

    const actsOk = settlementDocuments?.results?.filter((r) => r.success)?.length ?? 0
    const origin = getPublicSiteUrl()
    void sendToAdminTopic(
      'FINANCE',
      `✅ <b>Пул закрыт (выплата учтена)</b>\n` +
        `Пул: <code>${batchId}</code>\n` +
        `Броней завершено: ${bookingsCompleted}\n` +
        `PDF-актов партнёрам: ${actsOk}\n` +
        `<a href="${origin}/admin/settings/finances">Открыть финансовый пульт</a> — кнопка «Пакет для банка (ZIP)» у этой строки.`,
    )

    return {
      success: ledgerErrors.length === 0,
      batchId,
      bookingsCompleted,
      ledgerPosted,
      partnersSynced: partnerIds.size,
      ledgerErrors: ledgerErrors.length ? ledgerErrors : undefined,
      settlementDocuments,
    }
  }

  /**
   * Period export for accountant (all batches in range, `;` for Excel RU).
   */
  static async exportBatchesPeriodCsv(fromDay, toDay) {
    const from = `${fromDay}T00:00:00.000Z`
    const to = `${toDay}T23:59:59.999Z`
    const { data: batches, error } = await supabaseAdmin
      .from('payout_batches')
      .select('id,status,rail,scheduled_for,totals_thb,item_count,created_at,settled_at,exported_at')
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    const header = [
      'batch_id',
      'status',
      'rail',
      'scheduled_for',
      'item_count',
      'totals_thb',
      'created_at',
      'exported_at',
      'settled_at',
    ]
    const esc = (v) => {
      const raw = v == null ? '' : String(v)
      if (/[";\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`
      return raw
    }
    const rows = (batches || []).map((b) =>
      [
        b.id,
        b.status,
        b.rail,
        b.scheduled_for,
        b.item_count,
        b.totals_thb,
        b.created_at,
        b.exported_at ?? '',
        b.settled_at ?? '',
      ]
        .map(esc)
        .join(';'),
    )
    return ['\uFEFF' + header.join(';'), ...rows].join('\n')
  }
}

export default PayoutBatchService
