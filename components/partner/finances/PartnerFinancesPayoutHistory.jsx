'use client'

import { format } from 'date-fns'
import { ArrowDownToLine } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PAYOUT_STATUS_LABEL, PAYOUT_STATUS_COLORS } from '@/components/partner/finances/partner-finances-shared'
import {
  PartnerHostLedgerAmount,
  PartnerHostMidFxFootnote,
  PartnerHostPayoutAmount,
} from '@/components/partner/finances/partner-host-amount-display'
import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'
import { formatServerPayoutAmount } from '@/components/partner/finances/partner-payout-preview-display'

export function PartnerFinancesPayoutHistory({
  t,
  payouts,
  payoutsLoading,
  payoutsError,
  payoutsErr,
  onRefetchPayouts,
}) {
  const { formatThbLedgerSecondary, language } = usePartnerHostDisplayFx()

  const fmtPayoutFinal = (p) => {
    const cur = String(p.payoutCurrency || p.currency || 'THB').toUpperCase()
    const payoutCurAmount = p.amountInPayoutCurrency != null ? p.amountInPayoutCurrency : null
    if (cur !== 'THB' && payoutCurAmount != null) {
      return {
        primary: formatServerPayoutAmount(payoutCurAmount, cur, language),
        secondary: formatThbLedgerSecondary(p.finalAmount),
        usesServerPayout: true,
      }
    }
    return {
      primary: null,
      secondary: null,
      usesServerPayout: false,
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ArrowDownToLine className="h-5 w-5 text-slate-600" />
          {t('partnerFinances_payoutHistoryTitle')}
        </CardTitle>
        <CardDescription>{t('partnerFinances_payoutHistoryDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        {payoutsLoading ? (
          <div className="h-24 bg-slate-100 animate-pulse rounded-lg" />
        ) : payoutsError ? (
          <div className="text-sm text-red-700">
            {payoutsErr?.message}
            <Button variant="outline" size="sm" className="ml-2" onClick={() => onRefetchPayouts()}>
              {t('retry')}
            </Button>
          </div>
        ) : payouts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center text-sm text-slate-600">
            <p className="font-medium text-slate-800">{t('partnerFinances_payoutNoRowsTitle')}</p>
            <p className="mt-1 text-slate-500">{t('partnerFinances_payoutNoRows')}</p>
          </div>
        ) : (
          <>
            <div className="md:hidden space-y-3 min-w-0">
              {payouts.map((p) => {
                const methodName = p.payoutMethod?.name || p.method || '—'
                const st = String(p.status || '').toUpperCase()
                const finalDisplay = fmtPayoutFinal(p)
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2 text-sm min-w-0"
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <span className="text-slate-500 text-xs shrink-0">
                        {p.createdAt ? format(new Date(p.createdAt), 'dd.MM.yyyy HH:mm') : '—'}
                      </span>
                      <Badge className={`text-xs shrink-0 ${PAYOUT_STATUS_COLORS[st] || 'bg-slate-100'}`}>
                        {PAYOUT_STATUS_LABEL[st] || st}
                      </Badge>
                    </div>
                    <p className="font-medium text-slate-800 break-words">{methodName}</p>
                    <div className="grid grid-cols-1 gap-1 text-xs sm:text-sm">
                      <div className="flex justify-between gap-2 min-w-0">
                        <span className="text-slate-500 shrink-0">{t('partnerFinances_colMobileGross')}</span>
                        <span className="tabular-nums text-right break-all">
                          <PartnerHostLedgerAmount thb={p.grossAmount} />
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 min-w-0">
                        <span className="text-slate-500 shrink-0">{t('partnerFinances_colMobileBankFee')}</span>
                        <span className="tabular-nums text-amber-800 text-right break-all">
                          −<PartnerHostLedgerAmount thb={p.payoutFeeAmount} />
                        </span>
                      </div>
                      <div className="flex justify-between gap-2 pt-1 border-t border-slate-200 font-semibold min-w-0 items-start">
                        <span className="text-slate-700 shrink-0">{t('partnerFinances_colMobileFinal')}</span>
                        <span className="tabular-nums text-emerald-800 text-right break-all">
                          {finalDisplay.usesServerPayout ? (
                            <PartnerHostPayoutAmount
                              preview={{
                                amountInPayoutCurrency: p.amountInPayoutCurrency,
                                payoutCurrency: p.payoutCurrency || p.currency,
                                finalAmountThb: p.finalAmount,
                              }}
                            />
                          ) : (
                            <PartnerHostLedgerAmount thb={p.finalAmount} />
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 -mx-0">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="bg-slate-50 text-slate-600 text-left">
                  <tr>
                    <th className="px-3 py-2 font-medium">{t('partnerFinances_colDate')}</th>
                    <th className="px-3 py-2 font-medium">{t('partnerFinances_colMethod')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('partnerFinances_colGross')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('partnerFinances_colBankFee')}</th>
                    <th className="px-3 py-2 font-medium text-right">{t('partnerFinances_colFinal')}</th>
                    <th className="px-3 py-2 font-medium">{t('partnerFinances_colStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payouts.map((p) => {
                    const methodName = p.payoutMethod?.name || p.method || '—'
                    const st = String(p.status || '').toUpperCase()
                    const finalDisplay = fmtPayoutFinal(p)
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                          {p.createdAt ? format(new Date(p.createdAt), 'dd.MM.yyyy HH:mm') : '—'}
                        </td>
                        <td className="px-3 py-2 text-slate-800">{methodName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          <PartnerHostLedgerAmount thb={p.grossAmount} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-amber-800">
                          −<PartnerHostLedgerAmount thb={p.payoutFeeAmount} />
                        </td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-emerald-800">
                          {finalDisplay.usesServerPayout ? (
                            <PartnerHostPayoutAmount
                              preview={{
                                amountInPayoutCurrency: p.amountInPayoutCurrency,
                                payoutCurrency: p.payoutCurrency || p.currency,
                                finalAmountThb: p.finalAmount,
                              }}
                            />
                          ) : (
                            <PartnerHostLedgerAmount thb={p.finalAmount} />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={`text-xs ${PAYOUT_STATUS_COLORS[st] || 'bg-slate-100'}`}>
                            {PAYOUT_STATUS_LABEL[st] || st}
                          </Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <PartnerHostMidFxFootnote t={t} className="mt-3" />
          </>
        )}
      </CardContent>
    </Card>
  )
}
