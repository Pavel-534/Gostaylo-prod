/**
 * Stage 109.2 / 110.3 — payout batch settlement (prod partner payout path).
 *
 * Money flow: READY_FOR_PAYOUT bookings in LOCKED/EXPORTED batch → markBatchSettled
 * → two-phase: settling_at stamp → LedgerService.postPartnerBatchBookingPayoutSettled
 * → booking COMPLETED → syncPartnerBalanceColumns.
 * Not EscrowService.processPayout (legacy-payout-guard blocks on prod / manual treasury).
 *
 * AUDIT_02 P0: fail-closed — do not mark batch SETTLED while ledger posts fail;
 * AUDIT_MONEY_FLOW_04: catch-up COMPLETED if ledger exists; SETTLE_STUCK / SETTLE_ORPHAN alerts;
 * repair — re-run when already SETTLED to heal failed ledger lines (idempotent keys).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { syncPartnerBalanceColumns } from '@/lib/services/escrow/balance.service.js'
import { generateBatchPartnerSettlementDocuments } from '@/lib/services/payout-document.service.js'
import { sendToAdminTopic } from '@/lib/services/notifications/telegram.service.js'
import { getPublicSiteUrl } from '@/lib/site-url.js'
import {
  getBatchWithItems,
  OPEN_PARTNER_PAYOUT_STATUSES,
  round2,
} from '@/lib/services/payout-batch/payout-batch-shared.js'
import {
  maybeHeartbeatSettleLock,
  releasePayoutBatchSettleLock,
  tryClaimPayoutBatchSettleLock,
  withSettleLockMeta,
} from '@/lib/services/payout-batch/payout-batch-settle-lock.js'
import { isOpenPartnerHostPayoutRow } from '@/lib/referral/referral-payout-row.js'
import DisputeService from '@/lib/services/dispute.service.js'
import {
  isBookingDisputePaymentFrozen,
  isFrozenBookingLookupFailed,
} from '@/lib/partner/partner-payout-eligibility.js'
import { emitFreezeFailIfNeeded } from '@/lib/partner/freeze-fail-signal.js'
import { settleBatchItemTwoPhase } from '@/lib/services/payout-batch/payout-batch-settle-two-phase.js'

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
 * Fail-closed: batch stays LOCKED/EXPORTED (or SETTLED only after full success). Repair re-entry allowed when SETTLED.
 * Single-flight: Postgres CAS lock (stage201_02) — concurrent settle → settle_in_progress (409).
 *
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
  const isRepair = st === 'SETTLED'
  if (!isRepair && !['LOCKED', 'EXPORTED'].includes(st)) {
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

  const claim = await tryClaimPayoutBatchSettleLock(batchId, { owner: settledBy })
  if (!claim.claimed) {
    if (claim.reason === 'settle_in_progress') {
      return {
        success: false,
        error: 'settle_in_progress',
        status: claim.status || pack.batch.status,
        settleInProgressAt: claim.settleInProgressAt || null,
        settleLockOwner: claim.settleLockOwner || null,
        message:
          'Закрытие пула уже выполняется другим запросом. Дождитесь завершения или повторите через минуту.',
      }
    }
    if (claim.reason === 'not_found') return { success: false, error: 'not_found' }
    if (claim.reason === 'invalid_status') {
      return {
        success: false,
        error: 'invalid_status',
        status: claim.status,
        message: `Пул в статусе «${claim.status}» — закрытие недоступно.`,
      }
    }
    return {
      success: false,
      error: claim.reason || 'settle_lock_failed',
      message: claim.error || 'Не удалось захватить settle-lock. Примените миграцию stage201_02.',
    }
  }

  const lock = {
    settleInProgressAt: claim.settleInProgressAt,
    settleLockOwner: claim.settleLockOwner,
    settleLockToken: claim.settleLockToken,
  }

  try {
    return await runMarkBatchSettledBody({
      batchId,
      settledBy,
      pack,
      isRepair,
      lock,
    })
  } finally {
    // Always attempt release on return/throw. Process kill / OOM: TTL reclaim only (no row growth).
    try {
      await releasePayoutBatchSettleLock(batchId, claim.settleLockToken)
    } catch (releaseErr) {
      console.error(
        '[PayoutBatch] settle lock release failed',
        batchId,
        releaseErr?.message || releaseErr,
      )
    }
  }
}

/**
 * @param {{
 *   batchId: string,
 *   settledBy: string | null,
 *   pack: { batch: object, items?: object[] },
 *   isRepair: boolean,
 *   lock: { settleInProgressAt?: string | null, settleLockOwner?: string | null, settleLockToken?: string | null },
 * }} args
 */
async function runMarkBatchSettledBody({ batchId, settledBy, pack, isRepair, lock }) {
  const now = new Date().toISOString()
  const partnerIds = new Set()
  let bookingsCompleted = 0
  let ledgerPosted = 0
  const ledgerErrors = []
  const completedErrors = []
  const stuckItems = []
  const skippedDispute = []
  const heartbeat = {
    batchId,
    token: lock?.settleLockToken || null,
    lastBeatAt: { ms: Date.now() },
    lock,
  }

  const batchBookingIds = (pack.items || []).map((i) => i.booking_id).filter(Boolean)
  const frozenSet = await DisputeService.getFrozenBookingIdSet(batchBookingIds)
  // FAIL-CLOSED: do not settle or mark SKIPPED when freeze lookup failed
  // (returning "all frozen" alone would incorrectly SKIP every item).
  if (isFrozenBookingLookupFailed(frozenSet)) {
    emitFreezeFailIfNeeded(frozenSet, 'payout-batch-settle')
    return {
      success: false,
      error: 'freeze_lookup_failed',
      message: 'getFrozenBookingIdSet failed — batch settle blocked until disputes readable',
    }
  }

  for (const item of pack.items || []) {
    await maybeHeartbeatSettleLock(heartbeat)
    const amountThb = round2(item.amount_thb)
    const partnerId = item.partner_id
    const bookingId = item.booking_id
    if (!bookingId || !(amountThb > 0)) continue

    // Already skipped for dispute — do not re-process on repair.
    if (String(item.status || '').toUpperCase() === 'SKIPPED') {
      continue
    }

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

    // Two-phase: stamp settling_at → ledger (idempotent) → item SETTLED → booking COMPLETED.
    // Crash between ledger and COMPLETED: repair finds journal and catch-up status only.
    const phase = await settleBatchItemTwoPhase({
      item,
      bookingRow,
      batchId,
      settledBy,
      nowIso: now,
    })

    if (phase.outcome === 'stuck') {
      stuckItems.push({ bookingId, itemId: item.id })
      continue
    }

    if (phase.outcome === 'ledger_error') {
      ledgerErrors.push({ bookingId, error: phase.error })
      continue
    }

    if (phase.ledgerPosted) {
      ledgerPosted += 1
      if (partnerId) partnerIds.add(partnerId)
    }

    if (phase.bookingCompleted) {
      bookingsCompleted += 1
    }

    if (phase.outcome === 'completed_fail') {
      completedErrors.push({ bookingId, error: phase.error })
    }
  }

  for (const pid of partnerIds) {
    try {
      await syncPartnerBalanceColumns(pid)
    } catch (e) {
      console.error('[PayoutBatch] syncPartnerBalanceColumns', pid, e)
    }
  }

  const origin = getPublicSiteUrl()
  const baseMeta = withSettleLockMeta(
    {
      ...(pack.batch.metadata || {}),
      settled_by: settledBy || null,
      bookings_completed: bookingsCompleted,
      ledger_posted: ledgerPosted,
      skipped_dispute_count: skippedDispute.length,
      stuck_settle_count: stuckItems.length,
      completed_errors_count: completedErrors.length,
    },
    lock,
  )

  const hasHardFailures = ledgerErrors.length > 0 || completedErrors.length > 0 || stuckItems.length > 0

  if (hasHardFailures) {
    await supabaseAdmin
      .from('payout_batches')
      .update({
        // Stay LOCKED/EXPORTED so Concierge can retry; repair keeps SETTLED.
        updated_at: now,
        metadata: {
          ...baseMeta,
          ledger_errors: ledgerErrors.length ? ledgerErrors : null,
          completed_errors: completedErrors.length ? completedErrors : null,
          stuck_settle_items: stuckItems.length ? stuckItems : null,
          last_settle_attempt_at: now,
          last_settle_partial: true,
          repair_attempt: isRepair,
        },
      })
      .eq('id', batchId)

    if (ledgerErrors.length > 0) {
      void sendToAdminTopic(
        'FINANCE',
        `🚨 <b>Payout batch: ledger fail — пул НЕ закрыт</b>\n` +
          `Пул: <code>${batchId}</code>\n` +
          `Успешных ledger: ${ledgerPosted}\n` +
          `Ошибки: ${ledgerErrors.map((e) => `<code>${e.bookingId}</code>`).join(', ')}\n` +
          `Повторите «Закрыть пул» после исправления.\n` +
          `<a href="${origin}/admin/settings/finances">Финансовый пульт</a>`,
      )
    }

    if (completedErrors.length > 0) {
      void sendToAdminTopic(
        'FINANCE',
        `🚨 <b>Payout batch: ledger OK, COMPLETED fail</b>\n` +
          `Пул: <code>${batchId}</code>\n` +
          `Брони: ${completedErrors.map((e) => `<code>${e.bookingId}</code>`).join(', ')}\n` +
          `Повторите settle (catch-up статуса) или проверьте FSM.\n` +
          `<a href="${origin}/admin/settings/finances">Финансовый пульт</a>`,
      )
    }

    if (stuckItems.length > 0) {
      void sendToAdminTopic(
        'FINANCE',
        `🚨 <b>Payout batch: SETTLE_STUCK</b>\n` +
          `Пул: <code>${batchId}</code>\n` +
          `Items settling &gt;10m without ledger — manual review.\n` +
          `Брони: ${stuckItems.map((s) => `<code>${s.bookingId}</code>`).join(', ')}`,
      )
    }

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

    return {
      success: false,
      error: ledgerErrors.length
        ? 'ledger_errors'
        : stuckItems.length
          ? 'settle_stuck'
          : 'completed_errors',
      batchId,
      repair: isRepair,
      bookingsCompleted,
      ledgerPosted,
      partnersSynced: partnerIds.size,
      skippedDispute: skippedDispute.length ? skippedDispute : undefined,
      stuckItems: stuckItems.length ? stuckItems : undefined,
      ledgerErrors: ledgerErrors.length ? ledgerErrors : undefined,
      completedErrors: completedErrors.length ? completedErrors : undefined,
      message:
        'Часть settle не завершена (ledger / COMPLETED / stuck). Пул не помечен SETTLED. Повторите settle или разберите вручную.',
    }
  }

  const { data: batchClosed, error: batchCloseErr } = await supabaseAdmin
    .from('payout_batches')
    .update({
      status: 'SETTLED',
      settled_at: now,
      updated_at: now,
      metadata: {
        ...baseMeta,
        ledger_errors: null,
        completed_errors: null,
        stuck_settle_items: null,
        last_settle_partial: false,
        last_settle_attempt_at: now,
      },
    })
    .eq('id', batchId)
    .in('status', isRepair ? ['SETTLED'] : ['LOCKED', 'EXPORTED'])
    .select('id')
    .maybeSingle()

  if (batchCloseErr) {
    console.error('[PayoutBatch] settle batch update', batchId, batchCloseErr.message || batchCloseErr)
  } else if (!isRepair && !batchClosed?.id) {
    // Concurrent settle: peer already closed LOCKED→SETTLED; ledger lines are idempotent.
    console.warn('[PayoutBatch] settle batch CAS miss (already closed?)', batchId)
  }

  // Do NOT blanket-mark PENDING→SETTLED: stuck / failed items must stay PENDING for repair.

  let settlementDocuments = null
  try {
    await maybeHeartbeatSettleLock({ ...heartbeat, lastBeatAt: { ms: 0 } })
    settlementDocuments = await generateBatchPartnerSettlementDocuments(batchId, pack.items || [])
  } catch (docErr) {
    console.error('[PayoutBatch] settlement PDF', batchId, docErr)
  }

  const actsOk = settlementDocuments?.results?.filter((r) => r.success)?.length ?? 0
  void sendToAdminTopic(
    'FINANCE',
    `✅ <b>Пул закрыт (выплата учтена)</b>\n` +
      `Пул: <code>${batchId}</code>\n` +
      `Броней завершено: ${bookingsCompleted}\n` +
      (isRepair ? `🔧 Repair settle\n` : '') +
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
    success: true,
    batchId,
    repair: isRepair,
    alreadySettled: isRepair,
    bookingsCompleted,
    ledgerPosted,
    partnersSynced: partnerIds.size,
    skippedDispute: skippedDispute.length ? skippedDispute : undefined,
    settlementDocuments,
  }
}
