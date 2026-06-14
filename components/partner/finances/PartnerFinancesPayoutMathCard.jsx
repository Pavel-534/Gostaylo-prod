'use client'

import Link from 'next/link'
import { ArrowDownToLine } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PartnerPayoutPreviewFields } from '@/components/partner/finances/PartnerPayoutPreviewFields'

export function PartnerFinancesPayoutMathCard({
  t,
  language,
  financesSummary,
  summaryLoading,
  partnerId,
  partnerProfileVerified,
  defaultPayoutProfile,
  payoutPreview,
  payoutPreviewLoading,
  onOpenWithdraw,
}) {
  const hasProfile = !!defaultPayoutProfile?.id

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
        {hasProfile ? (
          <PartnerPayoutPreviewFields
            t={t}
            language={language}
            preview={payoutPreview}
            loading={payoutPreviewLoading || summaryLoading}
            financesSummary={financesSummary}
            variant="card"
          />
        ) : (
          <p className="text-slate-600 text-sm">{t('partnerFinances_payoutMathDescNoProfile')}</p>
        )}
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
            variant="brand"
            className="w-full gap-2 sm:w-auto"
            onClick={() => onOpenWithdraw(true)}
            disabled={
              summaryLoading ||
              payoutPreviewLoading ||
              !partnerId ||
              partnerProfileVerified !== true ||
              !hasProfile ||
              !payoutPreview?.finalAmountThb
            }
          >
            <ArrowDownToLine className="h-4 w-4 shrink-0" aria-hidden />
            {t('partnerFinances_withdrawCta')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
