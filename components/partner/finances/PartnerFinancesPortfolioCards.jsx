'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/currency'
import { PartnerPayoutPreviewSubline } from '@/components/partner/finances/PartnerPayoutPreviewSubline'
import { payoutPreviewAmountKey } from '@/lib/partner/partner-payout-preview-api'

export function PartnerFinancesPortfolioCards({
  t,
  language,
  financesSummary,
  loading,
  previewByAmountKey,
}) {
  const netThb = financesSummary?.portfolio?.netThb ?? 0
  const netPreview = previewByAmountKey?.[payoutPreviewAmountKey(netThb)]

  const cards = [
    {
      id: 'gross',
      title: t('partnerFinances_portfolioGrossTitle'),
      value: financesSummary?.portfolio?.grossThb ?? 0,
      className: 'text-2xl font-bold text-slate-900',
      subline: null,
      footer: (
        <p className="text-xs text-slate-500 mt-1">
          {financesSummary?.portfolio?.bookingCount ?? 0} {t('partnerFinances_portfolioBookingsLabel')}
        </p>
      ),
    },
    {
      id: 'fee',
      title: t('partnerFinances_portfolioFeeTitle'),
      value: financesSummary?.portfolio?.feeThb ?? 0,
      className: 'text-2xl font-bold text-red-700',
      subline: null,
      footer: null,
    },
    {
      id: 'net',
      title: t('partnerFinances_portfolioNetTitle'),
      value: netThb,
      className: 'text-2xl font-bold text-emerald-700',
      subline: netPreview,
      footer: <p className="text-xs text-slate-500 mt-2">{t('partnerFinances_rubIndicativeDisclaimer')}</p>,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <Card key={card.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">{card.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={card.className}>
              {loading ? '—' : formatPrice(card.value, 'THB', { THB: 1 }, language)}
            </div>
            {!loading && card.subline ? (
              <PartnerPayoutPreviewSubline preview={card.subline} language={language} className="mt-1" />
            ) : null}
            {!loading && card.footer}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
