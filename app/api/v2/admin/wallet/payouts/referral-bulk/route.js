/**
 * POST /api/v2/admin/wallet/payouts/referral-bulk
 * Stage 114.3 / 131.3 — массовый approve/reject очереди withdrawable_referral.
 * Approve: debit gross withdrawable + metadata fee (ADR §10).
 * Body: { action: 'approve' | 'reject', userIds: string[] }
 */
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdminStaff } from '@/lib/security/admin-staff-access'
import WalletService from '@/lib/services/finance/wallet.service'
import { buildReferralWithdrawalPreview } from '@/lib/services/marketing/referral-withdrawal-preview.service.js'
import { createReferralWithdrawalPayoutRow } from '@/lib/services/marketing/referral-payout-bridge.service.js'

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
    const patch = {
      referral_withdrawal_status: null,
      referral_withdrawal_requested_at: null,
      referral_withdrawal_amount_thb: null,
      updated_at: nowIso,
    }
    const { data, error } = await supabaseAdmin
      .from('user_wallets')
      .update(patch)
      .in('user_id', userIds)
      .eq('referral_withdrawal_status', 'withdrawable_referral')
      .select('user_id,referral_withdrawal_status')

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

    return NextResponse.json({
      success: true,
      data: {
        action,
        processed: (data || []).length,
        userIds: (data || []).map((r) => r.user_id),
      },
    })
  }

  const processed = []
  const failures = []

  for (const userId of userIds) {
    const { data: wallet, error: readErr } = await supabaseAdmin
      .from('user_wallets')
      .select(
        'user_id, withdrawable_balance_thb, referral_withdrawal_status, referral_withdrawal_amount_thb',
      )
      .eq('user_id', userId)
      .eq('referral_withdrawal_status', 'withdrawable_referral')
      .maybeSingle()

    if (readErr || !wallet?.user_id) {
      failures.push({ userId, error: readErr?.message || 'WALLET_NOT_IN_QUEUE' })
      continue
    }

    const grossThb = round2(
      wallet.referral_withdrawal_amount_thb ?? wallet.withdrawable_balance_thb ?? 0,
    )
    if (grossThb <= 0) {
      failures.push({ userId, error: 'ZERO_WITHDRAWAL_AMOUNT' })
      continue
    }

    const preview = await buildReferralWithdrawalPreview(grossThb, { payoutCurrency: 'RUB' })
    const referenceId = `referral_withdrawal_payout:${userId}:${nowIso.slice(0, 10)}`
    const debitMeta = {
      gross_thb: preview.grossThb,
      withdrawal_fee_thb: preview.withdrawalFeeThb,
      withdrawal_fee_percent: preview.withdrawalFeePercent,
      net_paid_thb: preview.netThb,
      net_paid_rub: preview.netInPayoutCurrency,
      payout_currency: 'RUB',
      fee_paid_by: preview.feePaidBy,
      approved_at: nowIso,
      referenceId,
    }

    const bridge = await createReferralWithdrawalPayoutRow({
      userId,
      grossThb,
      approvedAt: nowIso,
      walletDebitReferenceId: referenceId,
    })
    if (!bridge.success) {
      failures.push({ userId, error: bridge.error || 'PAYOUT_BRIDGE_FAILED' })
      continue
    }

    const debit = await WalletService.debitReferralWithdrawalPayout(userId, grossThb, {
      ...debitMeta,
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
      netRub: bridge.data?.netRub ?? preview.netInPayoutCurrency,
      feeThb: preview.withdrawalFeeThb,
      payoutId: bridge.data?.payoutId ?? null,
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
