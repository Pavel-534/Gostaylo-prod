/**
 * Stage 114.2 / 114.4 — снимок referral liability для FinTech-пульта.
 */
import { supabaseAdmin } from '@/lib/supabase'
import ReferralPnlService from '@/lib/services/marketing/referral-pnl.service.js'
import { buildReferralLedgerQuery } from '@/lib/admin/referral-ledger-query.js'
import { getReferralAdminAlertPolicy } from '@/lib/admin/referral-alert-policy.js'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

function monthKeyFromIso(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function buildLastMonthKeys(count = 6) {
  const keys = []
  const now = new Date()
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`)
  }
  return keys
}

/**
 * @param {{
 *   accrualLimit?: number,
 *   periodFrom?: string,
 *   periodTo?: string,
 *   ledgerStatus?: string,
 *   ledgerType?: string,
 *   topLimit?: number,
 * }} [opts]
 */
export async function loadReferralLiabilitySnapshot(opts = {}) {
  const limit = Math.min(50, Math.max(5, Number(opts.accrualLimit) || 20))
  const topLimit = Math.min(20, Math.max(3, Number(opts.topLimit) || 10))
  const periodFrom = String(opts.periodFrom || '').trim()
  const periodTo = String(opts.periodTo || '').trim()

  const monitor = await ReferralPnlService.getMonitorStats()
  const alertPolicy = await getReferralAdminAlertPolicy()

  const ledgerQuery = buildReferralLedgerQuery({
    status: opts.ledgerStatus || 'all',
    type: opts.ledgerType || 'all',
    dateFrom: periodFrom || undefined,
    dateTo: periodTo || undefined,
    limit: Math.max(limit, 200),
  })
  const { data: ledgerRows, error: ledErr } = await ledgerQuery
  if (ledErr) throw new Error(ledErr.message || 'REFERRAL_LEDGER_RECENT_FAILED')

  const { data: earnedAll, error: earnedErr } = await supabaseAdmin
    .from('referral_ledger')
    .select('amount_thb,referrer_id,earned_at,created_at,status')
    .eq('status', 'earned')
  if (earnedErr) throw new Error(earnedErr.message || 'REFERRAL_LEDGER_EARNED_AGG_FAILED')

  const { data: wallets, error: wErr } = await supabaseAdmin
    .from('user_wallets')
    .select(
      'user_id,withdrawable_balance_thb,balance_thb,internal_credits_thb,referral_withdrawal_status,referral_withdrawal_requested_at,referral_withdrawal_amount_thb',
    )
    .gt('balance_thb', 0)
  if (wErr) throw new Error(wErr.message || 'WALLET_WITHDRAWABLE_READ_FAILED')

  const walletWithdrawableTotalThb = round2(
    (wallets || []).reduce((acc, w) => acc + Number(w?.withdrawable_balance_thb || 0), 0),
  )
  const walletInternalTotalThb = round2(
    (wallets || []).reduce((acc, w) => acc + Number(w?.internal_credits_thb || 0), 0),
  )

  const { data: pendingRequests, error: prErr } = await supabaseAdmin
    .from('user_wallets')
    .select('user_id,withdrawable_balance_thb,referral_withdrawal_amount_thb,referral_withdrawal_requested_at')
    .eq('referral_withdrawal_status', 'withdrawable_referral')
  if (prErr) throw new Error(prErr.message || 'REFERRAL_PAYOUT_REQUESTS_FAILED')

  const pendingRequestTotalThb = round2(
    (pendingRequests || []).reduce(
      (acc, w) => acc + Number(w?.referral_withdrawal_amount_thb ?? w?.withdrawable_balance_thb ?? 0),
      0,
    ),
  )

  const monthKeys = buildLastMonthKeys(6)
  const flowMap = new Map(
    monthKeys.map((m) => [m, { month: m, earnedThb: 0, payoutRequestsThb: 0 }]),
  )

  for (const row of earnedAll || []) {
    const iso = row?.earned_at || row?.created_at
    const mk = iso ? monthKeyFromIso(iso) : null
    if (mk && flowMap.has(mk)) {
      flowMap.get(mk).earnedThb += Number(row?.amount_thb) || 0
    }
  }

  for (const w of wallets || []) {
    const iso = w?.referral_withdrawal_requested_at
    const mk = iso ? monthKeyFromIso(iso) : null
    if (mk && flowMap.has(mk)) {
      flowMap.get(mk).payoutRequestsThb += Number(w?.referral_withdrawal_amount_thb || 0)
    }
  }

  const accrualsVsPayouts = Array.from(flowMap.values()).map((row) => ({
    month: row.month,
    earnedThb: round2(row.earnedThb),
    payoutRequestsThb: round2(row.payoutRequestsThb),
  }))

  const periodEarnedByReferrer = new Map()
  const periodFromMs = periodFrom ? Date.parse(`${periodFrom}T00:00:00.000Z`) : null
  const periodToMs = periodTo ? Date.parse(`${periodTo}T23:59:59.999Z`) : null

  for (const row of earnedAll || []) {
    const iso = row?.earned_at || row?.created_at
    const ts = iso ? Date.parse(String(iso)) : NaN
    if (periodFromMs != null && Number.isFinite(ts) && ts < periodFromMs) continue
    if (periodToMs != null && Number.isFinite(ts) && ts > periodToMs) continue
    const rid = String(row?.referrer_id || '')
    if (!rid) continue
    periodEarnedByReferrer.set(rid, (periodEarnedByReferrer.get(rid) || 0) + Number(row?.amount_thb || 0))
  }

  const topAmbassadorIds = [...periodEarnedByReferrer.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topLimit)
    .map(([id]) => id)

  const profileIds = [
    ...new Set(
      [
        ...(pendingRequests || []).map((w) => String(w.user_id || '')),
        ...(ledgerRows || []).map((r) => String(r.referrer_id || '')),
        ...topAmbassadorIds,
      ].filter(Boolean),
    ),
  ].slice(0, 150)

  let profileMap = {}
  if (profileIds.length) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id,email,first_name,last_name')
      .in('id', profileIds)
    profileMap = Object.fromEntries((profiles || []).map((p) => [String(p.id), p]))
  }

  const accruals = (ledgerRows || []).slice(0, limit).map((row) => {
    const p = profileMap[String(row.referrer_id || '')]
    return {
      id: row.id,
      amountThb: round2(row.amount_thb),
      type: row.type,
      status: row.status,
      referralType: row.referral_type,
      ledgerDepth: row.ledger_depth,
      earnedAt: row.earned_at || row.created_at,
      bookingId: row.booking_id,
      referrerId: row.referrer_id,
      referrerEmail: p?.email || null,
    }
  })

  const topAmbassadors = topAmbassadorIds.map((referrerId, idx) => {
    const p = profileMap[referrerId]
    return {
      rank: idx + 1,
      referrerId,
      email: p?.email || null,
      name: [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || null,
      earnedThb: round2(periodEarnedByReferrer.get(referrerId) || 0),
    }
  })

  const payoutQueue = (pendingRequests || []).map((w) => {
    const p = profileMap[String(w.user_id || '')]
    return {
      userId: w.user_id,
      email: p?.email || null,
      name: [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim() || null,
      amountThb: round2(w.referral_withdrawal_amount_thb ?? w.withdrawable_balance_thb),
      requestedAt: w.referral_withdrawal_requested_at,
      status: 'withdrawable_referral',
    }
  })

  const ledgerEarnedTotalThb = round2(monitor.earnedTotalThb)
  /** Оценка «ещё в кошельках» (withdrawable — потенциальный исходящий cash). */
  const earnedInWalletsWithdrawableThb = walletWithdrawableTotalThb
  /** Разрыв ledger vs withdrawable (internal + уже выведено вне учёта). */
  const ledgerVsWalletGapThb = round2(ledgerEarnedTotalThb - walletWithdrawableTotalThb - walletInternalTotalThb)

  return {
    currency: 'THB',
    ledgerEarnedTotalThb,
    ledgerPendingTotalThb: round2(monitor.pendingTotalThb),
    ledgerCanceledTotalThb: round2(monitor.canceledTotalThb),
    marketingPromoPotThb: round2(monitor.marketingPromoPotThb),
    promoTankTopupsThb: round2(monitor.promoTankTopupsThb),
    promoTankDebitsThb: round2(monitor.promoTankDebitsThb),
    forecastHostActivationDebitThb: round2(monitor.forecastDebitNext10HostActivationsThb),
    walletWithdrawableTotalThb,
    walletInternalTotalThb,
    pendingReferralPayoutRequests: payoutQueue.length,
    pendingReferralPayoutTotalThb: pendingRequestTotalThb,
    referralLiabilityLedgerThb: ledgerEarnedTotalThb,
    earnedInWalletsWithdrawableThb,
    ledgerVsWalletGapThb,
    accruals,
    payoutQueue,
    topAmbassadors,
    accrualsVsPayouts,
    growthSeries: monitor.growthSeries || [],
    alertPolicy,
    filters: {
      periodFrom: periodFrom || null,
      periodTo: periodTo || null,
      ledgerStatus: opts.ledgerStatus || 'all',
      ledgerType: opts.ledgerType || 'all',
    },
  }
}
