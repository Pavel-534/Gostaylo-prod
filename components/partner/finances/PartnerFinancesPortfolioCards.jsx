'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { payoutPreviewAmountKey } from '@/lib/partner/partner-payout-preview-api'
import {
  PartnerHostLedgerAmount,
  PartnerHostMidFxFootnote,
  PartnerHostPayoutAmount,
} from '@/components/partner/finances/partner-host-amount-display'
import { usePartnerHostDisplayFx } from '@/lib/hooks/use-partner-host-display-fx'

export function PartnerFinancesPortfolioCards({
  t,
  financesSummary,
  loading,
  previewByAmountKey,
}) {
  const { getPayoutDisplay } = usePartnerHostDisplayFx()
  const netThb = financesSummary?.portfolio?.netThb ?? 0
  const netPreview = previewByAmountKey?.[payoutPreviewAmountKey(netThb)]
  const netPayoutDisplay = getPayoutDisplay(netPreview)

  const cards = [
    {
      id: 'gross',
      title: t('partnerFinances_portfolioGrossTitle'),
      valueThb: financesSummary?.portfolio?.grossThb ?? 0,
      className: 'text-2xl font-bold text-slate-900',
      payoutPreview: null,
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
      payoutPreview: null,
      footer: null,
    },
    {
      id: 'net',
      title: t('partnerFinances_portfolioNetTitle'),
      valueThb: netThb,
      className: 'text-2xl font-bold text-emerald-700',
      payoutPreview: netPreview,
      footer: (
        <p className="text-xs text-slate-500 mt-2">
          {netPayoutDisplay.usesServerPayout
            ? t('stage180_payoutVsLedgerDisclaimer')
            : t('partnerFinances_rubIndicativeDisclaimer')}
        </p>
      ),
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
                {loading ? (
                  '—'
                ) : card.id === 'net' && card.payoutPreview && netPayoutDisplay.usesServerPayout ? (
                  <PartnerHostPayoutAmount preview={card.payoutPreview} className="items-start" />
                ) : (
                  <PartnerHostLedgerAmount thb={card.valueThb} />
                )}
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
