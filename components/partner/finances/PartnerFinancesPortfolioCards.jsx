'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PartnerHostLedgerAmount, PartnerHostMidFxFootnote } from '@/components/partner/finances/partner-host-amount-display'

export function PartnerFinancesPortfolioCards({ t, financesSummary, loading }) {
  const cards = [
    {
      id: 'gross',
      title: t('partnerFinances_portfolioGrossTitle'),
      valueThb: financesSummary?.portfolio?.grossThb ?? 0,
      className: 'text-2xl font-bold text-slate-900',
      footer: (
        <p className="text-xs text-slate-500 mt-1">
          {financesSummary?.portfolio?.bookingCount ?? 0} {t('partnerFinances_portfolioBookingsLabel')}
        </p>
      ),
    },
    {
      id: 'fee',
      title: t('partnerFinances_portfolioFeeTitle'),
      valueThb: financesSummary?.portfolio?.feeThb ?? 0,
      className: 'text-2xl font-bold text-red-700',
      footer: null,
    },
    {
      id: 'net',
      title: t('partnerFinances_portfolioNetTitle'),
      valueThb: financesSummary?.portfolio?.netThb ?? 0,
      className: 'text-2xl font-bold text-emerald-700',
      footer: <p className="text-xs text-slate-500 mt-2">{t('partnerFinances_portfolioNetHint')}</p>,
    },
  ]

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">{card.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={card.className}>
                {loading ? '—' : <PartnerHostLedgerAmount thb={card.valueThb} />}
              </div>
              {!loading && card.footer}
            </CardContent>
          </Card>
        ))}
      </div>
      <PartnerHostMidFxFootnote t={t} />
    </div>
  )
}
