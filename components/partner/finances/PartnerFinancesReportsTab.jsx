'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PartnerFinancesDocuments } from '@/components/partner/finances/PartnerFinancesDocuments'
import { PartnerFinancesPdfCard } from '@/components/partner/finances/PartnerFinancesPdfCard'
import { PartnerFinancesPayoutHistory } from '@/components/partner/finances/PartnerFinancesPayoutHistory'
import { PartnerFinancesPortfolioCards } from '@/components/partner/finances/PartnerFinancesPortfolioCards'
import { PartnerFinancesReportsSubNav } from '@/components/partner/finances/PartnerFinancesReportsSubNav'

export function PartnerFinancesReportsTab({
  t,
  language,
  financesSummary,
  summaryLoadingCombined,
  payoutPreviewBatchLoading,
  pdfDateFrom,
  setPdfDateFrom,
  pdfDateTo,
  setPdfDateTo,
  pdfLoading,
  onExportPdf,
  onPresetCurrent,
  onPresetPrev,
  payouts,
  payoutsLoading,
  payoutsError,
  payoutsErr,
  onRefetchPayouts,
  payoutsInfoText,
}) {
  const [activeSubTab, setActiveSubTab] = useState('statements')

  return (
    <div className="space-y-6">
      <PartnerFinancesReportsSubNav t={t} activeSubTab={activeSubTab} onSubTabChange={setActiveSubTab} />

      {activeSubTab === 'statements' ? (
        <div className="space-y-8">
          <PartnerFinancesPortfolioCards
            t={t}
            financesSummary={financesSummary}
            loading={summaryLoadingCombined || payoutPreviewBatchLoading}
          />

          <PartnerFinancesPdfCard
            t={t}
            pdfDateFrom={pdfDateFrom}
            setPdfDateFrom={setPdfDateFrom}
            pdfDateTo={pdfDateTo}
            setPdfDateTo={setPdfDateTo}
            pdfLoading={pdfLoading}
            onExportPdf={onExportPdf}
            onPresetCurrent={onPresetCurrent}
            onPresetPrev={onPresetPrev}
          />

          <PartnerFinancesDocuments t={t} language={language} />
        </div>
      ) : null}

      {activeSubTab === 'payouts' ? (
        <PartnerFinancesPayoutHistory
          t={t}
          payouts={payouts}
          payoutsLoading={payoutsLoading}
          payoutsError={payoutsError}
          payoutsErr={payoutsErr}
          onRefetchPayouts={onRefetchPayouts}
        />
      ) : null}

      {activeSubTab === 'help' ? (
        <Card className="border-sky-200 bg-sky-50/80">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-sky-700 mt-0.5 shrink-0" aria-hidden />
              <div>
                <h4 className="font-semibold text-sky-950 mb-1">{t('howPayoutsWork')}</h4>
                <p className="text-sm text-sky-900/90 leading-relaxed">{payoutsInfoText}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
