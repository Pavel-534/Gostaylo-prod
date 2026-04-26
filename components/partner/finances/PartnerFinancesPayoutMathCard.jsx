'use client'

import Link from 'next/link'
import { ArrowDownToLine } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'

export function PartnerFinancesPayoutMathCard({
  t,
  currency,
  exchangeRates,
  financesSummary,
  summaryLoading,
  partnerId,
  partnerProfileVerified,
  defaultPayoutProfile,
  pendingPayoutPreview,
  onOpenWithdraw,
}) {
  return (
    <Card className="border-indigo-200 bg-indigo-50/50 min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-lg">{t('partnerFinances_payoutMathTitle')}</CardTitle>
        <CardDescription>
          {defaultPayoutProfile?.method?.name
            ? `${t('partnerFinances_payoutMathDefaultMethod')}: ${defaultPayoutProfile.method.name}`
            : t('partnerFinances_payoutMathDescNoProfile')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm min-w-0 overflow-x-auto">
        <div className="flex justify-between gap-3 min-w-0">
          <span className="text-slate-600 shrink-0">{t('partnerFinances_payoutMathBaseAvailable')}</span>
          <span className="font-medium tabular-nums text-right break-all min-w-0">
            {formatPrice(financesSummary?.availableThb ?? 0, currency, exchangeRates)}
          </span>
        </div>
        <div className="flex justify-between gap-3 min-w-0">
          <span className="text-slate-600 shrink-0">{t('partnerFinances_payoutMathFee')}</span>
          <span className="font-medium tabular-nums text-right break-all min-w-0">
            -{formatPrice(pendingPayoutPreview.fee, currency, exchangeRates)}
          </span>
        </div>
        <div className="flex justify-between gap-3 pt-2 border-t border-indigo-200 text-base font-semibold min-w-0">
          <span className="shrink-0">{t('partnerFinances_payoutMathFinal')}</span>
          <span className="text-indigo-700 tabular-nums text-right break-all min-w-0">
            {formatPrice(pendingPayoutPreview.final, currency, exchangeRates)}
          </span>
        </div>
        {partnerProfileVerified === false ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
            <p>{t('partnerFinances_payoutKycBlockedHint')}</p>
            <Button variant="link" className="h-auto p-0 mt-1 text-amber-900 underline" asChild>
              <Link href="/partner/settings">{t('partnerFinances_payoutKycLinkSettings')}</Link>
            </Button>
          </div>
        ) : null}
        <div className="pt-4">
          <Button
            type="button"
            className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 sm:w-auto"
            onClick={() => onOpenWithdraw(true)}
            disabled={summaryLoading || !partnerId || partnerProfileVerified !== true}
          >
            <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden />
            {t('partnerFinances_withdrawCta')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
