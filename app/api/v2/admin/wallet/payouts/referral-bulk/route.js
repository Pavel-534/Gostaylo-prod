/**
 * POST /api/v2/admin/wallet/payouts/referral-bulk
 * Stage 114.3 / 131.3 / 134 / 137 — массовый approve/reject очереди withdrawable_referral.
 * Approve: debit gross withdrawable + FX lock from referral_withdrawal_metadata (SSOT).
 * Reject: admin_comment required + dual-write audit (wallet_transactions + profiles notice).
 * Body: { action: 'approve' | 'reject', userIds: string[], admin_comment?: string }
 */

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import WalletService from '@/lib/services/finance/wallet.service'
import { createReferralWithdrawalPayoutRow } from '@/lib/services/marketing/referral-payout-bridge.service.js'
import { notifyReferralWithdrawalStatus } from '@/lib/services/marketing/referral-withdrawal-status-notify.service.js'
import { REFERRAL_WITHDRAWAL_CLEAR_PATCH } from '@/lib/finance/referral-payout-fx-policy.js'

export const dynamic = 'force-dynamic'

function round2(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export async function POST(request) {
  const access = await requireAdminStaff(request)
  if (access.error) return access.error

  let body = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const action = String(body?.action || '').trim().toLowerCase()
  const userIds = Array.isArray(body?.userIds)
    ? body.userIds.map((id) => String(id || '').trim()).filter(Boolean)
    : []

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ success: false, error: 'INVALID_ACTION' }, { status: 400 })
  }
  if (!userIds.length) {
    return NextResponse.json({ success: false, error: 'USER_IDS_REQUIRED' }, { status: 400 })
  }

  const nowIso = new Date().toISOString()

  if (action === 'reject') {
    const adminComment = String(body?.admin_comment ?? body?.adminComment ?? body?.reason ?? '').trim()
    if (adminComment.length < 3) {
      return NextResponse.json({ success: false, error: 'ADMIN_COMMENT_REQUIRED' }, { status: 400 })
    }

    const { data: walletsBefore, error: readErr } = await supabaseAdmin
      .from('user_wallets')
      .select(
        'user_id, id, balance_thb, referral_withdrawal_amount_thb, referral_withdrawal_metadata, withdrawable_balance_thb',
      )
      .in('user_id', userIds)
      .eq('referral_withdrawal_status', 'withdrawable_referral')

    if (readErr) {
      return NextResponse.json(
        { success: false, error: readErr.message || 'WALLET_READ_FAILED' },
        { status: 500 },
      )
    }

    const auditFailures = []
    for (const row of walletsBefore || []) {
      const fxMeta =
        row.referral_withdrawal_metadata && typeof row.referral_withdrawal_metadata === 'object'
          ? row.referral_withdrawal_metadata
          : {}
      const grossThb = round2(row.referral_withdrawal_amount_thb ?? row.withdrawable_balance_thb ?? 0)
      const audit = await WalletService.insertReferralWithdrawalRejectAudit(row.user_id, {
        adminComment,
        rejectedAt: nowIso,
        grossThb,
        netRub: Math.round(Number(fxMeta.requested_rub_amount) || 0),
      })
      if (!audit.success) {
        auditFailures.push({ userId: row.user_id, error: audit.error || 'REJECT_AUDIT_FAILED' })
      }
    }

    const patch = {
      ...REFERRAL_WITHDRAWAL_CLEAR_PATCH,
      updated_at: nowIso,
    }
    const { data, error } = await supabaseAdmin
      .from('user_wallets')
      .update(patch)
      .in('user_id', userIds)
      .eq('referral_withdrawal_status', 'withdrawable_referral')
      .select('user_id, referral_withdrawal_status')

    if (error) {
      if (/referral_withdrawal_/i.test(String(error.message || ''))) {
        return NextResponse.json(
          { success: false, error: 'REFERRAL_WITHDRAWAL_COLUMNS_MISSING' },
          { status: 503 },
        )
      }
      return NextResponse.json(
        { success: false, error: error.message || 'REFERRAL_BULK_UPDATE_FAILED' },
        { status: 500 },
      )
    }

    for (const row of walletsBefore || []) {
      const fxMeta =
        row.referral_withdrawal_metadata && typeof row.referral_withdrawal_metadata === 'object'
          ? row.referral_withdrawal_metadata
          : {}
      void notifyReferralWithdrawalStatus(row.user_id, 'rejected', {
        grossThb: round2(row.referral_withdrawal_amount_thb ?? row.withdrawable_balance_thb ?? 0),
        netRub: Math.round(Number(fxMeta.requested_rub_amount) || 0),
        reason: adminComment,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        action,
        processed: (data || []).length,
        userIds: (data || []).map((r) => r.user_id),
        auditFailures,
      },
    })
  }

  const processed = []
  const failures = []

  for (const userId of userIds) {
    const expired = await WalletService.clearExpiredReferralWithdrawalIfNeeded(userId)
    if (expired.expired) {
      failures.push({ userId, error: 'REFERRAL_PAYOUT_FX_LOCK_EXPIRED' })
      continue
    }

    const { data: wallet, error: readErr } = await supabaseAdmin
      .from('user_wallets')
      .select(
        'user_id, withdrawable_balance_thb, referral_withdrawal_status, referral_withdrawal_amount_thb, referral_withdrawal_metadata',
      )
      .eq('user_id', userId)
      .eq('referral_withdrawal_status', 'withdrawable_referral')
      .maybeSingle()

    if (readErr || !wallet?.user_id) {
      failures.push({ userId, error: readErr?.message || 'WALLET_NOT_IN_QUEUE' })
      continue
    }

    const grossThb = round2(wallet.referral_withdrawal_amount_thb ?? wallet.withdrawable_balance_thb ?? 0)
    if (grossThb <= 0) {
      failures.push({ userId, error: 'ZERO_WITHDRAWAL_AMOUNT' })
      continue
    }

    const referenceId = `referral_withdrawal_payout:${userId}:${nowIso.slice(0, 10)}`

    const bridge = await createReferralWithdrawalPayoutRow({
      userId,
      grossThb,
      approvedAt: nowIso,
      walletDebitReferenceId: referenceId,
      fxLock: wallet.referral_withdrawal_metadata,
    })
    if (!bridge.success) {
      if (bridge.error === 'REFERRAL_PAYOUT_FX_LOCK_EXPIRED') {
        await WalletService.clearExpiredReferralWithdrawalIfNeeded(userId)
      }
      failures.push({ userId, error: bridge.error || 'PAYOUT_BRIDGE_FAILED' })
      continue
    }

    const preview = bridge.data.preview
    const netRub = bridge.data.netRub
    const fxLockUsed = bridge.data.fxLockUsed

    const debit = await WalletService.debitReferralWithdrawalPayout(userId, grossThb, {
      gross_thb: preview.grossThb,
      withdrawal_fee_thb: preview.withdrawalFeeThb,
      withdrawal_fee_percent: preview.withdrawalFeePercent,
      net_paid_thb: preview.netThb,
      net_paid_rub: netRub,
      mid_rate_to_thb: fxLockUsed?.requestedFxRate ?? null,
      fx_locked_at: fxLockUsed?.requestedFxRateAt ?? null,
      payout_currency: 'RUB',
      fee_paid_by: preview.feePaidBy,
      approved_at: nowIso,
      referenceId,
      payout_id: bridge.data?.payoutId ?? null,
    })
    if (!debit.success || debit.data?.applied !== true) {
      if (bridge.data?.payoutId) {
        await supabaseAdmin
          .from('payouts')
          .update({
            status: 'FAILED',
            rejection_reason: debit.error || debit.data?.reason || 'DEBIT_FAILED',
            updated_at: nowIso,
          })
          .eq('id', bridge.data.payoutId)
      }
      failures.push({
        userId,
        error: debit.error || debit.data?.reason || 'DEBIT_FAILED',
      })
      continue
    }

    const { error: updErr } = await supabaseAdmin
      .from('user_wallets')
      .update({
        referral_withdrawal_status: 'paid',
        referral_withdrawal_requested_at: null,
        referral_withdrawal_amount_thb: null,
        referral_withdrawal_metadata: null,
        updated_at: nowIso,
      })
      .eq('user_id', userId)
      .eq('referral_withdrawal_status', 'withdrawable_referral')

    if (updErr) {
      failures.push({ userId, error: updErr.message || 'STATUS_UPDATE_FAILED' })
      continue
    }

    processed.push({
      userId,
      grossThb: preview.grossThb,
      netThb: preview.netThb,
      netRub,
      feeThb: preview.withdrawalFeeThb,
      payoutId: bridge.data?.payoutId ?? null,
    })

    void notifyReferralWithdrawalStatus(userId, 'approved', {
      payoutId: bridge.data?.payoutId,
      grossThb: preview.grossThb,
      netThb: preview.netThb,
      netRub,
    })
  }

  return NextResponse.json({
    success: failures.length === 0,
    data: {
      action,
      processed: processed.length,
      userIds: processed.map((p) => p.userId),
      payouts: processed,
      failures,
    },
  })
}
