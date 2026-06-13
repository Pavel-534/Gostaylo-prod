/**
 * Stage 131.8 — orchestrates fraud-queue review → ledger + wallet + payout block flags.
 *
 * Call site: PATCH /api/v2/admin/referral/fraud-queue/[id]
 */
import { supabaseAdmin } from '@/lib/supabase'
import ReferralGuardService from '@/lib/services/marketing/referral-guard.service.js'
import ReferralLedgerService from '@/lib/services/marketing/referral-ledger.service.js'
import {
  hasOpenFraudQueueForUsers,
  setReferralPayoutBlocked,
} from '@/lib/services/marketing/referral-fraud-gate.service.js'
import {
  beneficiaryIdForLedgerRow,
  sumSecurityHeldReferralThbForUser,
} from '@/lib/services/marketing/referral-hold.service.js'
import { REFERRAL_STATUSES } from '@/lib/services/marketing/referral-calculation.js'

const LEDGER_SELECT =
  'id,booking_id,referrer_id,referee_id,amount_thb,type,status,metadata,ledger_depth,referral_type'

function round2(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function isFraudGateHeldLedgerRow(row) {
  if (String(row?.status || '').toLowerCase() !== REFERRAL_STATUSES.EARNED_HELD) return false
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  return meta.fraud_gate_hold === true
}

/**
 * @param {string} queueId
 */
async function fetchQueueItem(queueId) {
  const id = String(queueId || '').trim()
  if (!id) return null
  const { data, error } = await supabaseAdmin
    .from('referral_fraud_queue')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message || 'FRAUD_QUEUE_READ_FAILED')
  return data || null
}

/**
 * @param {object} queueItem
 * @returns {Promise<object[]>}
 */
async function findRelatedFraudHeldLedgerRows(queueItem) {
  const meta = queueItem?.metadata && typeof queueItem.metadata === 'object' ? queueItem.metadata : {}
  const ledgerId = String(meta.ledger_id || '').trim()
  const bookingId = String(meta.booking_id || '').trim()
  const beneficiaryIds = [
    String(queueItem?.candidate_user_id || '').trim(),
    String(queueItem?.referrer_id || '').trim(),
  ].filter(Boolean)

  if (ledgerId) {
    const { data, error } = await supabaseAdmin
      .from('referral_ledger')
      .select(LEDGER_SELECT)
      .eq('id', ledgerId)
      .maybeSingle()
    if (error) throw new Error(error.message || 'LEDGER_READ_FAILED')
    return data && isFraudGateHeldLedgerRow(data) ? [data] : []
  }

  let q = supabaseAdmin
    .from('referral_ledger')
    .select(LEDGER_SELECT)
    .eq('status', REFERRAL_STATUSES.EARNED_HELD)
    .limit(100)
  if (bookingId) q = q.eq('booking_id', bookingId)

  const { data, error } = await q
  if (error) throw new Error(error.message || 'LEDGER_HELD_READ_FAILED')

  return (data || []).filter((row) => {
    if (!isFraudGateHeldLedgerRow(row)) return false
    if (!beneficiaryIds.length) return true
    const bid = beneficiaryIdForLedgerRow(row)
    return beneficiaryIds.includes(bid)
  })
}

/**
 * @param {string[]} userIds
 * @param {string} [excludeQueueId]
 */
async function hasOtherOpenFraudTickets(userIds, excludeQueueId = null) {
  const ids = [...new Set((userIds || []).map((x) => String(x || '').trim()).filter(Boolean))]
  if (!ids.length) return false

  const { data, error } = await supabaseAdmin
    .from('referral_fraud_queue')
    .select('id,status,referrer_id,candidate_user_id')
    .eq('status', 'open')
    .limit(100)
  if (error) {
    if (/does not exist/i.test(String(error.message || ''))) return false
    throw error
  }

  const exclude = String(excludeQueueId || '').trim()
  return (data || []).some((row) => {
    if (exclude && String(row.id) === exclude) return false
    const rid = String(row.referrer_id || '')
    const cid = String(row.candidate_user_id || '')
    return ids.some((uid) => uid === rid || uid === cid)
  })
}

export class ReferralFraudResolveService {
  /**
   * @param {{ id: string, action: string, adminUserId?: string, note?: string }} params
   */
  static async resolveFraudItem(params = {}) {
    const queueId = String(params.id || '').trim()
    const action = String(params.action || '').trim().toLowerCase()
    const adminUserId = params.adminUserId ? String(params.adminUserId) : null
    const note = params.note != null ? String(params.note).trim() : ''

    if (!queueId) throw new Error('FRAUD_QUEUE_ID_REQUIRED')
    if (!['approved', 'blocked', 'flagged'].includes(action)) {
      throw new Error('FRAUD_QUEUE_ACTION_INVALID')
    }

    const queueItem = await fetchQueueItem(queueId)
    if (!queueItem?.id) throw new Error('FRAUD_QUEUE_NOT_FOUND')

    let ledgerOutcome = {
      approvedRows: [],
      rejectedRows: [],
      creditedBookingIds: [],
      creditedAmountThb: 0,
      payoutBlockedCleared: null,
    }

    if (action === 'approved') {
      const rows = await findRelatedFraudHeldLedgerRows(queueItem)
      ledgerOutcome = await this._approveFraudHeldRows(rows, { adminUserId, note, queueId })
      ledgerOutcome.payoutBlockedCleared = await this._syncPayoutBlockedAfterApprove(rows, queueId)
    } else if (action === 'blocked') {
      const rows = await findRelatedFraudHeldLedgerRows(queueItem)
      ledgerOutcome = await this._rejectFraudHeldRows(rows, { adminUserId, note })
      await this._syncPayoutBlockedAfterBlock(rows)
    }

    const reviewed = await ReferralGuardService.reviewFraudQueueItem({
      id: queueId,
      action,
      adminUserId,
      note,
    })

    return {
      queue: reviewed,
      ...ledgerOutcome,
    }
  }

  /**
   * @param {object[]} rows
   * @param {{ adminUserId?: string, note?: string, queueId?: string }} ctx
   */
  static async _approveFraudHeldRows(rows, ctx = {}) {
    const nowIso = new Date().toISOString()
    const approvedRows = []
    const bookingIds = new Set()

    for (const row of rows || []) {
      if (!row?.id || !isFraudGateHeldLedgerRow(row)) continue
      const prevMeta = row?.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {}
      delete prevMeta.fraud_gate_hold
      delete prevMeta.fraud_gate_rules
      delete prevMeta.fraud_gate_at
      delete prevMeta.fraud_gate_severity

      const nextMeta = {
        ...prevMeta,
        fraud_gate_resolved: 'approved',
        fraud_gate_resolved_at: nowIso,
        fraud_gate_resolved_by: ctx.adminUserId || null,
        fraud_resolve_note: ctx.note || null,
        fraud_resolve_queue_id: ctx.queueId || null,
      }

      const { error } = await supabaseAdmin
        .from('referral_ledger')
        .update({
          status: REFERRAL_STATUSES.EARNED,
          earned_at: nowIso,
          updated_at: nowIso,
          unlock_at: null,
          metadata: nextMeta,
        })
        .eq('id', String(row.id))
        .eq('status', REFERRAL_STATUSES.EARNED_HELD)
      if (error) throw new Error(error.message || 'FRAUD_LEDGER_APPROVE_FAILED')

      approvedRows.push(String(row.id))
      if (row.booking_id) bookingIds.add(String(row.booking_id))
    }

    const creditedBookingIds = []
    let creditedAmountThb = 0
    for (const bookingId of bookingIds) {
      await ReferralLedgerService.creditWalletFromEarnedRows(bookingId)
      creditedBookingIds.push(bookingId)
    }
    for (const row of rows || []) {
      if (approvedRows.includes(String(row.id))) {
        creditedAmountThb += round2(row?.amount_thb)
      }
    }

    return { approvedRows, rejectedRows: [], creditedBookingIds, creditedAmountThb: round2(creditedAmountThb) }
  }

  /**
   * @param {object[]} rows
   * @param {{ adminUserId?: string, note?: string }} ctx
   */
  static async _rejectFraudHeldRows(rows, ctx = {}) {
    const nowIso = new Date().toISOString()
    const rejectedRows = []

    for (const row of rows || []) {
      if (!row?.id || !isFraudGateHeldLedgerRow(row)) continue
      const prevMeta = row?.metadata && typeof row.metadata === 'object' ? { ...row.metadata } : {}
      const nextMeta = {
        ...prevMeta,
        fraud_gate_resolved: 'blocked',
        fraud_gate_resolved_at: nowIso,
        fraud_gate_resolved_by: ctx.adminUserId || null,
        fraud_resolve_note: ctx.note || null,
        fraud_rejected_at: nowIso,
        admin_fraud_reject: true,
      }

      const { error } = await supabaseAdmin
        .from('referral_ledger')
        .update({
          status: REFERRAL_STATUSES.CANCELED,
          canceled_at: nowIso,
          updated_at: nowIso,
          metadata: nextMeta,
        })
        .eq('id', String(row.id))
        .eq('status', REFERRAL_STATUSES.EARNED_HELD)
      if (error) throw new Error(error.message || 'FRAUD_LEDGER_REJECT_FAILED')

      rejectedRows.push(String(row.id))
    }

    return { approvedRows: [], rejectedRows, creditedBookingIds: [] }
  }

  /** @param {object[]} rows @param {string} excludeQueueId @returns {Promise<boolean|null>} */
  static async _syncPayoutBlockedAfterApprove(rows, excludeQueueId) {
    const userIds = new Set()
    for (const row of rows || []) {
      const bid = beneficiaryIdForLedgerRow(row)
      if (bid) userIds.add(bid)
    }
    let anyCleared = false
    for (const uid of userIds) {
      const otherOpen = await hasOtherOpenFraudTickets([uid], excludeQueueId)
      const securityHeld = await sumSecurityHeldReferralThbForUser(uid)
      if (!otherOpen && securityHeld <= 0) {
        await setReferralPayoutBlocked(uid, false)
        anyCleared = true
      }
    }
    return userIds.size ? anyCleared : null
  }

  /** @param {object[]} rows */
  static async _syncPayoutBlockedAfterBlock(rows) {
    const userIds = new Set()
    for (const row of rows || []) {
      const bid = beneficiaryIdForLedgerRow(row)
      if (bid) userIds.add(bid)
    }
    for (const uid of userIds) {
      await setReferralPayoutBlocked(uid, true, 'FRAUD_RESOLVE_BLOCKED')
    }
  }
}

export default ReferralFraudResolveService
