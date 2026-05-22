/**
 * Stage 114.5 — ручной hold/reject referral_ledger (без смены правил начисления).
 */
import { supabaseAdmin } from '@/lib/supabase'
import ReferralLedgerService from '@/lib/services/marketing/referral-ledger.service.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * @param {string} ledgerId
 * @param {{ action: 'hold' | 'release_hold' | 'reject', adminUserId?: string, note?: string }} input
 */
export async function applyReferralLedgerAdminAction(ledgerId, input = {}) {
  const id = String(ledgerId || '').trim()
  const action = String(input?.action || '').trim().toLowerCase()
  if (!id) return { success: false, error: 'LEDGER_ID_REQUIRED' }
  if (!['hold', 'release_hold', 'reject'].includes(action)) {
    return { success: false, error: 'INVALID_ACTION' }
  }

  const { data: row, error } = await supabaseAdmin
    .from('referral_ledger')
    .select('id,booking_id,status,amount_thb,referrer_id,referee_id,type,metadata')
    .eq('id', id)
    .maybeSingle()
  if (error) return { success: false, error: error.message || 'LEDGER_READ_FAILED' }
  if (!row?.id) return { success: false, error: 'NOT_FOUND' }

  const status = String(row.status || '').toLowerCase()
  const nowIso = new Date().toISOString()
  const prevMeta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  const adminMeta = {
    admin_user_id: input?.adminUserId || null,
    admin_note: String(input?.note || '').trim() || null,
    admin_updated_at: nowIso,
  }

  if (action === 'hold') {
    if (status !== 'pending') return { success: false, error: 'HOLD_ONLY_PENDING' }
    const { error: upErr } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        metadata: { ...prevMeta, ...adminMeta, admin_hold: true, admin_hold_at: nowIso },
        updated_at: nowIso,
      })
      .eq('id', id)
    if (upErr) return { success: false, error: upErr.message || 'HOLD_UPDATE_FAILED' }
    return { success: true, action, ledgerId: id, status: 'pending', adminHold: true }
  }

  if (action === 'release_hold') {
    const { error: upErr } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        metadata: {
          ...prevMeta,
          ...adminMeta,
          admin_hold: false,
          admin_hold_released_at: nowIso,
        },
        updated_at: nowIso,
      })
      .eq('id', id)
    if (upErr) return { success: false, error: upErr.message || 'RELEASE_HOLD_FAILED' }
    return { success: true, action, ledgerId: id, adminHold: false }
  }

  if (status === 'pending') {
    const { error: cancelErr } = await supabaseAdmin
      .from('referral_ledger')
      .update({
        status: 'canceled',
        canceled_at: nowIso,
        updated_at: nowIso,
        metadata: { ...prevMeta, ...adminMeta, admin_rejected_at: nowIso, admin_reject_reason: 'admin_reject_pending' },
      })
      .eq('id', id)
      .eq('status', 'pending')
    if (cancelErr) return { success: false, error: cancelErr.message || 'REJECT_PENDING_FAILED' }
    return { success: true, action, ledgerId: id, canceled: 1 }
  }

  if (status === 'earned') {
    const claw = await ReferralLedgerService.clawbackSingleEarnedRow(id, {
      trigger: 'admin_reject',
      adminNote: adminMeta.admin_note,
    })
    if (!claw?.success) return claw
    return { success: true, action, ledgerId: id, clawback: claw }
  }

  return { success: false, error: 'STATUS_NOT_ACTIONABLE', status }
}
