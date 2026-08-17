'use client'

import { useEffect, useRef, useState } from 'react'
import { Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PartnerFinancesDocuments } from '@/components/partner/finances/PartnerFinancesDocuments'
import { PartnerFinancesPdfCard } from '@/components/partner/finances/PartnerFinancesPdfCard'
import { PartnerFinancesPeriodPackCard } from '@/components/partner/finances/PartnerFinancesPeriodPackCard'
import { PartnerFinancesPayoutHistory } from '@/components/partner/finances/PartnerFinancesPayoutHistory'
import { PartnerFinancesReportsSubNav } from '@/components/partner/finances/PartnerFinancesReportsSubNav'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import {
  PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
  PARTNER_HUB_SOFT_CARD_PAD_CLASS,
  PARTNER_SECTION_TITLE_CLASS,
} from '@/lib/ui/partner-section-rhythm'
import { cn } from '@/lib/utils'

export function PartnerFinancesReportsTab({
  t,
  language,
  pdfDateFrom,
  setPdfDateFrom,
  pdfDateTo,
  setPdfDateTo,
  exportAxis,
  setExportAxis,
  exportLoading,
  pdfLoading,
  csvLoading,
  onExportCsv,
  onExportPdf,
  onPresetCurrent,
  onPresetPrev,
  onPresetQuarter,
  periodPack,
  periodPackLoading,
  periodPackError,
  onRefetchPeriodPack,
  payouts,
  payoutsLoading,
  payoutsError,
  payoutsErr,
  onRefetchPayouts,
  payoutsInfoText,
}) {
  const [activeSubTab, setActiveSubTab] = useState('statements')
  const [archiveOpen, setArchiveOpen] = useState(false)
  const archiveRef = useRef(null)

  useEffect(() => {
    if (!archiveOpen) return
    archiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [archiveOpen])

  return (
    <div className="space-y-0">
      <PartnerFinancesReportsSubNav t={t} activeSubTab={activeSubTab} onSubTabChange={setActiveSubTab} />

      <PartnerSectionDivider />

      {activeSubTab === 'statements' ? (
        <section data-partner-section="finances-statements" className="space-y-3">
          <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerFinances_sectionReports')}</h2>

          <PartnerFinancesPdfCard
            t={t}
            language={language}
            pdfDateFrom={pdfDateFrom}
            setPdfDateFrom={setPdfDateFrom}
            pdfDateTo={pdfDateTo}
            setPdfDateTo={setPdfDateTo}
            exportAxis={exportAxis}
            setExportAxis={setExportAxis}
            exportLoading={exportLoading}
            pdfLoading={pdfLoading}
            csvLoading={csvLoading}
            onExportCsv={onExportCsv}
            onExportPdf={onExportPdf}
            onPresetCurrent={onPresetCurrent}
            onPresetPrev={onPresetPrev}
            onPresetQuarter={onPresetQuarter}
          />

          <PartnerFinancesPeriodPackCard
            t={t}
            pack={periodPack}
            loading={periodPackLoading}
            error={periodPackError}
            onRetry={onRefetchPeriodPack}
            archiveOpen={archiveOpen}
            onToggleArchive={() => setArchiveOpen((open) => !open)}
          />

          {archiveOpen ? (
            <div id="partner-finances-docs-archive" ref={archiveRef}>
              <PartnerFinancesDocuments t={t} language={language} />
            </div>
          ) : null}
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
            <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, PARTNER_HUB_SOFT_CARD_PAD_CLASS, 'sm:p-6')}>
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
