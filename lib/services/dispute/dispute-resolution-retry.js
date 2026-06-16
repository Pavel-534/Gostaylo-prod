/**
 * Stage 153.2 — manual saga repair: finalize dispute row when ledger already DONE.
 * Never re-invokes ledger services (double-spend guard).
 */

import { supabaseAdmin } from '@/lib/supabase'
import DisputeService from '@/lib/services/dispute.service'
import { DisputeResolutionStrategy } from '@/lib/services/dispute/dispute-resolution-engine.js'

const TERMINAL_STATUSES = new Set(['RESOLVED', 'CLOSED', 'REJECTED'])

function readMeta(dispute) {
  return dispute?.metadata && typeof dispute.metadata === 'object' ? dispute.metadata : {}
}

function buildTerminalPatch({ dispute, replay, actorId, now }) {
  const meta = readMeta(dispute)
  const flags =
    dispute.admin_action_flags && typeof dispute.admin_action_flags === 'object'
      ? { ...dispute.admin_action_flags }
      : {}

  const targetStatus = String(
    replay?.targetStatus || meta.resolution_ledger_target_status || 'RESOLVED',
  ).toUpperCase()
  const resolutionReason = String(
    replay?.resolutionReason || meta.resolution_ledger_reason || dispute.resolution_reason || '',
  ).slice(0, 2000)
  const trigger = String(replay?.trigger || meta.resolution_ledger_trigger || '').toLowerCase()
  const strategy = String(replay?.strategy || '').toUpperCase()

  const nextMeta = {
    ...meta,
    resolution_saga_repaired_at: now,
    resolution_saga_repaired_by: actorId || null,
    resolution_ledger_status: 'REPAIRED',
  }

  if (trigger.includes('force_refund') || strategy === DisputeResolutionStrategy.REFUND_GUEST) {
    flags.force_refund = true
    Object.assign(nextMeta, {
      force_refund_ledger: true,
      force_refund_requested_at: now,
      force_refund_requested_by: actorId || meta.resolution_ledger_actor_id || null,
    })
  }

  if (trigger.includes('split') || strategy === DisputeResolutionStrategy.SPLIT) {
    flags.split_resolved = true
    if (replay?.guestPercent != null) nextMeta.split_guest_percent = replay.guestPercent
    if (replay?.refundGuestThb != null) nextMeta.split_refund_guest_thb = replay.refundGuestThb
    if (replay?.partnerReleaseThb != null) nextMeta.split_partner_release_thb = replay.partnerReleaseThb
    nextMeta.split_resolved_at = now
    nextMeta.split_resolved_by = actorId || null
  }

  if (trigger.includes('close_dispute') || targetStatus === 'CLOSED') {
    Object.assign(nextMeta, {
      closed_at: now,
      closed_by_staff: actorId || null,
      admin_verdict: resolutionReason || meta.admin_verdict || null,
    })
  }

  return {
    status: targetStatus,
    resolved_at: now,
    closed_by: actorId || meta.resolution_ledger_actor_id || null,
    current_deadline_at: null,
    freeze_payment: false,
    resolution_reason: resolutionReason || null,
    admin_action_flags: flags,
    metadata: nextMeta,
    updated_at: now,
  }
}

/**
 * @param {string} disputeId
 * @param {{ actorId?: string, actorRole?: string, reason?: string }} opts
 */
export async function retryDisputeResolutionTerminalState(disputeId, opts = {}) {
  const id = String(disputeId || '').trim()
  if (!id || !supabaseAdmin) {
    return { success: false, error: 'invalid_input' }
  }

  const { data: dispute, error } = await supabaseAdmin
    .from('disputes')
    .select(
      'id, booking_id, status, metadata, admin_action_flags, resolution_reason, conversation_id, freeze_payment',
    )
    .eq('id', id)
    .maybeSingle()

  if (error || !dispute) {
    return { success: false, error: error?.message || 'dispute_not_found' }
  }

  const status = String(dispute.status || '').toUpperCase()
  if (TERMINAL_STATUSES.has(status)) {
    return { success: true, noop: true, disputeId: id, status }
  }

  const meta = readMeta(dispute)
  const ledgerStatus = String(meta.resolution_ledger_status || '').toUpperCase()
  if (ledgerStatus !== 'DONE') {
    return {
      success: false,
      error: 'resolution_ledger_not_done',
      resolutionLedgerStatus: ledgerStatus || null,
    }
  }

  const replay = meta.resolution_saga_replay && typeof meta.resolution_saga_replay === 'object'
    ? meta.resolution_saga_replay
    : null

  const now = new Date().toISOString()
  const actorId = opts.actorId ? String(opts.actorId) : null
  const patch = buildTerminalPatch({ dispute, replay, actorId, now })

  const { error: upErr } = await supabaseAdmin.from('disputes').update(patch).eq('id', id)
  if (upErr) {
    return { success: false, error: upErr.message || 'dispute_update_failed' }
  }

  const prevStatus = String(dispute.status || '')
  await DisputeService.appendDisputeEvent(id, {
    eventType: 'RESOLUTION_SAGA_RETRY',
    fromStatus: prevStatus,
    toStatus: patch.status,
    actorId,
    actorRole: opts.actorRole || 'ADMIN',
    reason: opts.reason || 'Manual saga repair (ledger already settled)',
    metadata: {
      resolution_ledger_status: ledgerStatus,
      trigger: replay?.trigger || meta.resolution_ledger_trigger || null,
    },
  })

  return {
    success: true,
    disputeId: id,
    fromStatus: prevStatus,
    toStatus: patch.status,
    resolutionReason: patch.resolution_reason,
  }
}
