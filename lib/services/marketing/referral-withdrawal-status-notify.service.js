/**
 * Stage 132.3 / 135 — user notifications when referral withdrawal moves through FinTech pipeline.
 */
import { NotificationService, NotificationEvents } from '@/lib/services/notification.service.js'
import { supabaseAdmin } from '@/lib/supabase'

const IN_APP_NOTICE_TTL_MS = 14 * 24 * 60 * 60 * 1000

/**
 * @param {string} userId
 * @param {'approved' | 'registry_sent' | 'paid' | 'rejected' | 'expired'} stage
 * @param {{ payoutId?: string, grossThb?: number, netRub?: number, netThb?: number, reason?: string }} payload
 */
export async function notifyReferralWithdrawalStatus(userId, stage, payload = {}) {
  const uid = String(userId || '').trim()
  if (!uid || !stage) return

  const eventByStage = {
    approved: NotificationEvents.REFERRAL_WITHDRAWAL_APPROVED,
    registry_sent: NotificationEvents.REFERRAL_WITHDRAWAL_REGISTRY_SENT,
    paid: NotificationEvents.REFERRAL_WITHDRAWAL_PAID,
    rejected: NotificationEvents.REFERRAL_WITHDRAWAL_REJECTED,
    expired: NotificationEvents.REFERRAL_WITHDRAWAL_EXPIRED,
  }
  const event = eventByStage[stage]
  if (!event) return

  if (stage === 'rejected' || stage === 'expired') {
    await persistReferralWithdrawalInAppNotice(uid, stage, payload)
  }

  try {
    await NotificationService.dispatch(event, {
      userId: uid,
      payoutId: payload.payoutId ? String(payload.payoutId) : null,
      grossThb: Number(payload.grossThb) || 0,
      netThb: Number(payload.netThb) || 0,
      netRub: Number(payload.netRub) || 0,
      reason: payload.reason ? String(payload.reason) : null,
    })
  } catch (e) {
    console.warn('[REFERRAL_WITHDRAWAL_NOTIFY]', stage, uid, e?.message || e)
  }
}

/** Stage 135 — in-app banner SSOT via profiles.metadata (no new table). */
export async function persistReferralWithdrawalInAppNotice(userId, stage, payload = {}) {
  const uid = String(userId || '').trim()
  if (!uid || !stage) return
  try {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', uid)
      .maybeSingle()
    const meta = prof?.metadata && typeof prof.metadata === 'object' ? prof.metadata : {}
    await supabaseAdmin
      .from('profiles')
      .update({
        metadata: {
          ...meta,
          referral_withdrawal_notice: {
            stage: String(stage),
            at: new Date().toISOString(),
            netRub: Number(payload.netRub) || null,
            grossThb: Number(payload.grossThb) || null,
            reason: payload.reason ? String(payload.reason) : null,
          },
        },
      })
      .eq('id', uid)
  } catch (e) {
    console.warn('[REFERRAL_WITHDRAWAL_NOTICE]', stage, uid, e?.message || e)
  }
}

export async function clearReferralWithdrawalInAppNotice(userId) {
  const uid = String(userId || '').trim()
  if (!uid) return
  try {
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('metadata')
      .eq('id', uid)
      .maybeSingle()
    const meta = prof?.metadata && typeof prof.metadata === 'object' ? prof.metadata : {}
    if (!meta.referral_withdrawal_notice) return
    const { referral_withdrawal_notice: _drop, ...rest } = meta
    await supabaseAdmin.from('profiles').update({ metadata: rest }).eq('id', uid)
  } catch {
    /* optional */
  }
}

/**
 * @param {Record<string, unknown> | null | undefined} metadata
 * @returns {{ stage: string, at: string, netRub?: number, grossThb?: number, reason?: string } | null}
 */
export function readReferralWithdrawalInAppNotice(metadata) {
  const meta = metadata && typeof metadata === 'object' ? metadata : {}
  const notice = meta.referral_withdrawal_notice
  if (!notice || typeof notice !== 'object' || !notice.stage || !notice.at) return null
  const atMs = Date.parse(String(notice.at))
  if (!Number.isFinite(atMs) || Date.now() - atMs > IN_APP_NOTICE_TTL_MS) return null
  return {
    stage: String(notice.stage),
    at: String(notice.at),
    netRub: Number(notice.netRub) || null,
    grossThb: Number(notice.grossThb) || null,
    reason: notice.reason ? String(notice.reason) : null,
  }
}

export default {
  notifyReferralWithdrawalStatus,
  persistReferralWithdrawalInAppNotice,
  clearReferralWithdrawalInAppNotice,
  readReferralWithdrawalInAppNotice,
}
