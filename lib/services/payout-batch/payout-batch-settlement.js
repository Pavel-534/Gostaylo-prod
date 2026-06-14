/**
 * Stage 109.2 / 110.3 — payout batch settlement (prod partner payout path).
 *
 * Money flow: READY_FOR_PAYOUT bookings in LOCKED/EXPORTED batch → markBatchSettled
 * → LedgerService.postPartnerBatchBookingPayoutSettled per item → booking COMPLETED → syncPartnerBalanceColumns.
 * Not EscrowService.processPayout (legacy-payout-guard blocks on prod / manual treasury).
 */
import { supabaseAdmin } from '@/lib/supabase'
import LedgerService from '@/lib/services/ledger.service.js'
import { syncPartnerBalanceColumns } from '@/lib/services/escrow/balance.service.js'
import { BookingStatus } from '@/lib/services/escrow/constants.js'
import { generateBatchPartnerSettlementDocuments } from '@/lib/services/payout-document.service.js'
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import {
  getBatchWithItems,
  OPEN_PARTNER_PAYOUT_STATUSES,
  round2,
} from '@/lib/services/payout-batch/payout-batch-shared.js'
import { transitionBookingStatus } from '@/lib/services/booking/booking-status.service.js'
import { isOpenPartnerHostPayoutRow } from '@/lib/referral/referral-payout-row.js'
import DisputeService from '@/lib/services/dispute.service.js'
import { isBookingDisputePaymentFrozen } from '@/lib/partner/partner-payout-eligibility.js'

/**
 * Block batch settle when partners in the pool have open manual payout requests (PENDING/PROCESSING).
 * @param {string} batchId
 */
export async function getBatchSettleBlockers(batchId) {
  const pack = await getBatchWithItems(batchId)
  if (!pack?.batch) return { canSettle: false, blockers: [{ code: 'not_found' }] }

  const partnerIds = [...new Set((pack.items || []).map((i) => i.partner_id).filter(Boolean))]
  if (!partnerIds.length) return { canSettle: true, blockers: [] }

  const { data: openPayouts, error } = await supabaseAdmin
    .from('payouts')
    .select('id, partner_id, status, gross_amount, created_at, payout_rail, metadata')
    .in('partner_id', partnerIds)
    .in('status', OPEN_PARTNER_PAYOUT_STATUSES)

  if (error) {
    return { canSettle: false, blockers: [{ code: 'db_error', message: error.message }] }
  }

  const hostOpenPayouts = (openPayouts || []).filter(isOpenPartnerHostPayoutRow)

  const byPartner = new Map()
  for (const row of hostOpenPayouts) {
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
 * Mark treasury batch paid: ledger debit per booking, booking → COMPLETED, sync partner balances.
 * @param {string} batchId
 * @param {string | null} [settledBy]
 */
export async function markBatchSettled(batchId, settledBy = null) {
  const { assertTreasuryOpsAllowed } = await import('@/lib/treasury/treasury-ops-config.js')
  const gate = await assertTreasuryOpsAllowed('payout')
  if (!gate.allowed) {
    return { success: false, error: gate.code, message: gate.message }
  }

  const pack = await getBatchWithItems(batchId)
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

  const settleGuard = await getBatchSettleBlockers(batchId)
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
  const skippedDispute = []

  const batchBookingIds = (pack.items || []).map((i) => i.booking_id).filter(Boolean)
  const frozenSet = await DisputeService.getFrozenBookingIdSet(batchBookingIds)

  for (const item of pack.items || []) {
    const amountThb = round2(item.amount_thb)
    const partnerId = item.partner_id
    const bookingId = item.booking_id
    if (!bookingId || !(amountThb > 0)) continue

    const { data: bookingRow } = await supabaseAdmin
      .from('bookings')
      .select('id, status, metadata')
      .eq('id', bookingId)
      .maybeSingle()

    if (isBookingDisputePaymentFrozen(bookingRow || { id: bookingId }, frozenSet)) {
      skippedDispute.push({ bookingId, disputeBlocked: true })
      await supabaseAdmin
        .from('payout_batch_items')
        .update({
          status: 'SKIPPED',
          updated_at: now,
          metadata: {
            ...(item.metadata && typeof item.metadata === 'object' ? item.metadata : {}),
            skipped_reason: 'dispute_or_mediation_blocked',
            skipped_at: now,
          },
        })
        .eq('id', item.id)
      continue
    }

    const ledger = await LedgerService.postPartnerBatchBookingPayoutSettled({
      batchId,
      bookingId,
      partnerId,
      amountThb,
    })
    if (ledger.success) ledgerPosted += 1
    else if (!ledger.skipped) ledgerErrors.push({ bookingId, error: ledger.error })

    const booking = bookingRow
    if (booking && ['READY_FOR_PAYOUT', 'THAWED'].includes(String(booking.status))) {
      const meta = booking.metadata && typeof booking.metadata === 'object' ? booking.metadata : {}
      const statusRes = await transitionBookingStatus(bookingId, BookingStatus.COMPLETED, {
        scope: 'system',
        actorContext: { trigger: 'payout_batch_settled' },
        metadata: { completedAt: now, updatedAt: now },
        extraPatch: {
          payout_at: now,
          metadata: {
            ...meta,
            payout_batch_id: batchId,
            payout_batch_settled_at: now,
            payout_batch_settled_by: settledBy || null,
          },
        },
      })
      if (statusRes.success) {
        bookingsCompleted += 1
      }
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
        skipped_dispute_count: skippedDispute.length,
      },
    })
    .eq('id', batchId)
  await supabaseAdmin
    .from('payout_batch_items')
    .update({ status: 'SETTLED', updated_at: now })
    .eq('batch_id', batchId)
    .neq('status', 'SKIPPED')

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
      (skippedDispute.length
        ? `⚠️ Пропущено (спор/медиация): ${skippedDispute.length} — <code>${skippedDispute.map((s) => s.bookingId).join(', ')}</code>\n`
        : '') +
      `PDF-актов партнёрам: ${actsOk}\n` +
      `<a href="${origin}/admin/settings/finances">Открыть финансовый пульт</a> — кнопка «Пакет для банка (ZIP)» у этой строки.`,
  )

  if (skippedDispute.length) {
    void sendToAdminTopic(
      'FINANCE',
      `🚨 <b>Payout batch: брони исключены из settle</b>\n` +
        `Пул: <code>${batchId}</code>\n` +
        `Причина: активный спор или медиация (Stage 141 guard)\n` +
        `Брони: ${skippedDispute.map((s) => `<code>${s.bookingId}</code>`).join(', ')}\n` +
        `<a href="${origin}/admin/disputes">Центр споров</a>`,
    )
  }

  const { invalidateFinancialIntelligenceCache } = await import(
    '@/lib/analytics/core/invalidate-financial-intelligence.js'
  )
  await invalidateFinancialIntelligenceCache()

  return {
    success: ledgerErrors.length === 0,
    batchId,
    bookingsCompleted,
    ledgerPosted,
    partnersSynced: partnerIds.size,
    skippedDispute: skippedDispute.length ? skippedDispute : undefined,
    ledgerErrors: ledgerErrors.length ? ledgerErrors : undefined,
    settlementDocuments,
  }
}
