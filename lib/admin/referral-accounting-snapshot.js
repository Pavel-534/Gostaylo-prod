/**
 * Stage 114.5 — бухгалтерский снимок referral (FinTech SSOT).
 */
import { supabaseAdmin } from '@/lib/supabase'
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service.js'
import { loadReferralLiabilitySnapshot } from '@/lib/admin/referral-liability-snapshot.js'
import { getReferralAdminAlertPolicy } from '@/lib/admin/referral-alert-policy.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function isReferralWalletPayoutDebit(row) {
  const txType = String(row?.tx_type || '').toLowerCase()
  const ref = String(row?.reference_id || '').toLowerCase()
  const meta = row?.metadata && typeof row.metadata === 'object' ? row.metadata : {}
  if (meta?.referralPayout === true || meta?.referral_withdrawal === true) return true
  if (txType.includes('referral') && (txType.includes('payout') || txType.includes('withdraw'))) return true
  if (ref.startsWith('referral_withdraw') || ref.startsWith('referral_payout')) return true
  return false
}

function currentUtcMonthStartIso() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
}

/**
 * @param {Parameters<typeof loadReferralLiabilitySnapshot>[0]} [opts]
 */
export async function loadReferralAccountingSnapshot(opts = {}) {
  const [liability, monitor, alertPolicy] = await Promise.all([
    loadReferralLiabilitySnapshot(opts),
    ReferralPnlService.getMonitorStats(),
    getReferralAdminAlertPolicy(),
  ])

  const monthStartIso = currentUtcMonthStartIso()

  const [monthEarnedRes, walletDebitsRes, heldRes] = await Promise.all([
    supabaseAdmin
      .from('referral_ledger')
      .select('amount_thb')
      .eq('status', 'earned')
      .gte('earned_at', monthStartIso),
    supabaseAdmin
      .from('wallet_transactions')
      .select('amount_thb,tx_type,reference_id,metadata,created_at')
      .eq('operation_type', 'debit')
      .order('created_at', { ascending: false })
      .limit(5000),
    supabaseAdmin
      .from('referral_ledger')
      .select('id,amount_thb,status,booking_id,referrer_id,created_at,metadata')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  if (monthEarnedRes.error) throw new Error(monthEarnedRes.error.message || 'REFERRAL_MONTH_EARNED_FAILED')
  if (walletDebitsRes.error) throw new Error(walletDebitsRes.error.message || 'WALLET_DEBITS_READ_FAILED')

  const monthlyEarnedThb = round2(
    (monthEarnedRes.data || []).reduce((acc, r) => acc + Number(r?.amount_thb || 0), 0),
  )

  let totalWithdrawnThb = 0
  let monthlyWithdrawnThb = 0
  for (const row of walletDebitsRes.data || []) {
    if (!isReferralWalletPayoutDebit(row)) continue
    const amt = round2(row?.amount_thb)
    totalWithdrawnThb += amt
    const created = row?.created_at ? Date.parse(String(row.created_at)) : NaN
    if (Number.isFinite(created) && created >= Date.parse(monthStartIso)) {
      monthlyWithdrawnThb += amt
    }
  }
  totalWithdrawnThb = round2(totalWithdrawnThb)
  monthlyWithdrawnThb = round2(monthlyWithdrawnThb)

  const totalEarnedThb = round2(monitor.earnedTotalThb ?? liability.ledgerEarnedTotalThb)
  const promoTankUsageThb = round2(monitor.promoTankDebitsThb ?? liability.promoTankDebitsThb)
  const netMarketingCostThb = round2(totalEarnedThb + promoTankUsageThb)
  const currentLiabilityThb = round2(
    Math.max(0, totalEarnedThb - totalWithdrawnThb - round2(liability.ledgerCanceledTotalThb || 0)),
  )
  const walletExposureThb = round2(
    Number(liability.walletWithdrawableTotalThb || 0) + Number(liability.walletInternalTotalThb || 0),
  )

  const heldRows = (heldRes.data || [])
    .filter((row) => row?.metadata?.admin_hold === true)
    .slice(0, 50)
    .map((row) => ({
    id: row.id,
    amountThb: round2(row.amount_thb),
    bookingId: row.booking_id,
    referrerId: row.referrer_id,
    createdAt: row.created_at,
    adminNote: row?.metadata?.admin_note || null,
  }))

  return {
    ...liability,
    accounting: {
      currency: 'THB',
      totalEarnedThb,
      totalWithdrawnThb,
      monthlyEarnedThb,
      monthlyWithdrawnThb,
      currentLiabilityThb,
      walletExposureThb,
      promoTankBalanceThb: round2(monitor.marketingPromoPotThb ?? liability.marketingPromoPotThb),
      promoTankUsageThb,
      promoTankTopupsThb: round2(monitor.promoTankTopupsThb ?? liability.promoTankTopupsThb),
      netMarketingCostThb,
      pendingLedgerThb: round2(monitor.pendingTotalThb ?? liability.ledgerPendingTotalThb),
      heldCount: heldRows.length,
      heldRows,
      monthlySpendAlertThb: alertPolicy.monthlySpendAlertThb,
      monthlySpendWarnPercent: alertPolicy.monthlySpendWarnPercent,
      monthlySpendWarnThb: alertPolicy.monthlySpendWarnThb,
      monthlySpendPercent:
        alertPolicy.monthlySpendAlertThb > 0
          ? Math.min(100, Math.round((monthlyEarnedThb / alertPolicy.monthlySpendAlertThb) * 1000) / 10)
          : 0,
      monthlySpendRemainingThb: Math.max(0, round2(alertPolicy.monthlySpendAlertThb - monthlyEarnedThb)),
      monthlySpendApproaching:
        monthlyEarnedThb >= alertPolicy.monthlySpendWarnThb &&
        monthlyEarnedThb < alertPolicy.monthlySpendAlertThb,
      monthlySpendAlertTriggered: monthlyEarnedThb >= alertPolicy.monthlySpendAlertThb,
    },
  }
}
