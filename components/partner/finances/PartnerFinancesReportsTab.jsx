'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PartnerFinancesDocuments } from '@/components/partner/finances/PartnerFinancesDocuments'
import { PartnerFinancesPdfCard } from '@/components/partner/finances/PartnerFinancesPdfCard'
import { PartnerFinancesPayoutHistory } from '@/components/partner/finances/PartnerFinancesPayoutHistory'
import { PartnerFinancesPortfolioCards } from '@/components/partner/finances/PartnerFinancesPortfolioCards'
import { PartnerFinancesReportsSubNav } from '@/components/partner/finances/PartnerFinancesReportsSubNav'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import {
  PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'
import { cn } from '@/lib/utils'

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
    <div className="space-y-0">
      <PartnerFinancesReportsSubNav t={t} activeSubTab={activeSubTab} onSubTabChange={setActiveSubTab} />

      <PartnerSectionDivider />

      {activeSubTab === 'statements' ? (
        <section data-partner-section="finances-statements" className="space-y-3">
          <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerFinances_sectionReports')}</h2>
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
        </section>
      ) : null}

      {activeSubTab === 'payouts' ? (
        <section data-partner-section="finances-payout-history" className="space-y-3">
          <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerFinances_payoutHistoryTitle')}</h2>
          <PartnerFinancesPayoutHistory
            t={t}
            payouts={payouts}
            payoutsLoading={payoutsLoading}
            payoutsError={payoutsError}
            payoutsErr={payoutsErr}
            onRefetchPayouts={onRefetchPayouts}
          />
        </section>
      ) : null}

      {activeSubTab === 'help' ? (
        <section data-partner-section="finances-payout-help" className="space-y-3">
          <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('howPayoutsWork')}</h2>
          <Card
            className={cn(
              MOBILE_FLAT_CARD_CLASS,
              PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
              'sm:border-sky-200 sm:bg-sky-50/80',
            )}
          >
            <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'sm:p-6')}>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden />
                <div>
                  <p className="mb-1 font-semibold text-sky-950">{t('howPayoutsWork')}</p>
                  <p className="text-sm leading-relaxed text-sky-900/90">{payoutsInfoText}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  )
}
