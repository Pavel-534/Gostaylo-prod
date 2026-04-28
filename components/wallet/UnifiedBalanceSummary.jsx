'use client'

/**
 * Stage 72.6 — единый снимок «бонусы маркетинга» vs «эскроу партнёра» (разные потоки в БД).
 * Данные: GET /api/v2/wallet/me (поле partnerEscrow для PARTNER).
 * Даты здесь не выводятся; формат DD.MM.YYYY для рефералки см. `lib/referral/format-referral-datetime.js`.
 */

import { Wallet, PiggyBank, Landmark, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function formatThb(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

export function UnifiedBalanceSummary({ walletPayload, t }) {
  const w = walletPayload?.wallet
  const balances = walletPayload?.balances
  const wd = Number(balances?.withdrawableBalanceThb ?? w?.withdrawable_balance_thb ?? 0)
  const internal = Number(balances?.internalCreditsThb ?? w?.internal_credits_thb ?? 0)
  const marketingTotal = Math.max(0, wd + internal)
  const escrow = walletPayload?.partnerEscrow

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50/90 to-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-teal-700" />
          {t('referralStage726_unifiedBalanceTitle')}
        </CardTitle>
        <CardDescription>{t('referralStage726_unifiedBalanceSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white/80 p-3 space-y-2">
          <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
            {t('referralStage726_marketingWalletLabel')}
          </p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-start gap-2">
              <PiggyBank className="h-4 w-4 text-emerald-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  {t('referralStage726_withdrawableLabel')}
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-slate-400 hover:text-slate-600" aria-label="info">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{t('referralStage726_tooltipWithdrawable')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </p>
                <p className="text-lg font-semibold tabular-nums text-slate-900">฿{formatThb(wd)}</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <PiggyBank className="h-4 w-4 text-indigo-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  {t('referralStage726_internalServicesLabel')}
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="text-slate-400 hover:text-slate-600" aria-label="info">
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">{t('referralStage726_tooltipInternal')}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </p>
                <p className="text-lg font-semibold tabular-nums text-slate-900">฿{formatThb(internal)}</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 pt-1 border-t border-slate-100">
            {t('referralStage726_marketingTotal')}:{' '}
            <span className="font-semibold tabular-nums text-slate-800">฿{formatThb(marketingTotal)}</span>
          </p>
        </div>

        {escrow && (Number(escrow.frozenBalanceThb) > 0 || Number(escrow.availableBalanceThb) > 0) ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
            <p className="text-xs font-medium text-amber-950 uppercase tracking-wide flex items-center gap-2">
              <Landmark className="h-4 w-4" />
              {t('referralStage726_escrowWalletLabel')}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-amber-800/70" aria-label="info">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">{t('referralStage726_tooltipEscrowBlock')}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-amber-900/80">{t('referralStage726_escrowFrozen')}</p>
                <p className="font-semibold tabular-nums text-amber-950">฿{formatThb(escrow.frozenBalanceThb)}</p>
              </div>
              <div>
                <p className="text-xs text-amber-900/80">{t('referralStage726_escrowAvailable')}</p>
                <p className="font-semibold tabular-nums text-amber-950">฿{formatThb(escrow.availableBalanceThb)}</p>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
