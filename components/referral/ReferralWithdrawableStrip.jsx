'use client'

import { useRouter } from 'next/navigation'
import { ArrowRight, Clock, Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

function statusLabel(status, t) {
  const s = String(status || '').toLowerCase()
  if (s === 'withdrawable_referral') return t?.('stage1146_withdrawStatusPending') || 'Заявка на вывод'
  if (s === 'paid') return t?.('stage1146_withdrawStatusPaid') || 'Выплачено'
  return status || ''
}

/**
 * Stage 114.4 / 114.6 — withdrawable referral balance (SSOT `GET /api/v2/wallet/me`).
 */
export function ReferralWithdrawableStrip({ walletData, t, locale, className = '', loading = false }) {
  const router = useRouter()
  const balances = walletData?.balances || {}
  const wallet = walletData?.wallet || {}
  const withdrawableThb = Number(
    balances?.withdrawableBalanceThb ?? wallet?.withdrawable_balance_thb ?? 0,
  )
  const internalThb = Number(balances?.internalCreditsThb ?? wallet?.internal_credits_thb ?? 0)
  const totalThb = Number(balances?.totalBalanceThb ?? wallet?.balance_thb ?? 0)
  const payout = walletData?.payout || {}
  const payoutEligible = payout?.payoutEligible === true
  const refStatus = payout?.referralWithdrawalStatus
  const refAmount = Number(payout?.referralWithdrawalAmountThb || 0)
  const label = t?.('referralStage726_withdrawableLabel') || 'К выводу'

  if (loading) {
    return (
      <div
        className={`rounded-xl border border-brand/25 bg-brand/10 px-4 py-4 flex items-center gap-2 text-brand-hover ${className}`}
      >
        <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden />
        <span className="text-sm">{t?.('referralStage726_load') || 'Загрузка кошелька…'}</span>
      </div>
    )
  }

  if (!(totalThb > 0) && !(withdrawableThb > 0) && !refStatus) return null

  return (
    <div
      className={`rounded-xl border border-brand/25 bg-gradient-to-br from-brand/10 via-white to-white px-4 py-4 text-brand shadow-sm ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="rounded-lg bg-brand/15 p-2 shrink-0">
            <Wallet className="h-5 w-5 text-brand-hover" aria-hidden />
          </div>
          <div className="min-w-0 space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-brand-hover/90">{label}</p>
              <p className="text-2xl sm:text-3xl font-black tabular-nums text-brand tracking-tight">
                {formatThb(withdrawableThb, locale)} <span className="text-base font-semibold">THB</span>
              </p>
              {refStatus ? (
                <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-950 text-[10px]">
                  <Clock className="h-3 w-3 mr-1 inline" />
                  {statusLabel(refStatus, t)}
                  {refAmount > 0 ? ` · ${formatThb(refAmount, locale)}` : ''}
                </Badge>
              ) : null}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600">
              <div className="rounded-md bg-white/80 border border-slate-100 px-2 py-1.5">
                <span className="block text-slate-400">{t?.('stage1146_walletTotal') || 'Всего'}</span>
                <span className="font-semibold tabular-nums">{formatThb(totalThb, locale)}</span>
              </div>
              <div className="rounded-md bg-white/80 border border-slate-100 px-2 py-1.5">
                <span className="block text-slate-400">{t?.('stage1146_walletInternal') || 'На услуги'}</span>
                <span className="font-semibold tabular-nums">{formatThb(internalThb, locale)}</span>
              </div>
              <div className="rounded-md bg-brand/10 border border-brand/20 px-2 py-1.5 col-span-2 sm:col-span-1">
                <span className="block text-brand-hover/80">{label}</span>
                <span className="font-semibold tabular-nums text-brand">{formatThb(withdrawableThb, locale)}</span>
              </div>
            </div>
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          variant="brand"
          className="w-full sm:w-auto shrink-0 min-h-11"
          onClick={() => router.push('/profile/wallet')}
        >
          {payoutEligible && !refStatus
            ? (t?.('stage1143_withdrawCta') || 'Вывести').replace('{amount}', formatThb(withdrawableThb, locale))
            : t?.('stage1143_tabNavWallet') || 'Кошелёк'}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}
