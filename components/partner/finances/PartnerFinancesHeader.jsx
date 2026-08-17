'use client'

import { PageSectionHeader } from '@/components/product/PageSectionHeader'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { interpolateTemplate } from '@/components/partner/finances/partner-payout-preview-display'
import { formatPartnerFinancesPeriodLabel } from '@/lib/partner/partner-finances-period-label'
import { PARTNER_HUB_PAGE_TITLE_MD_HIDE_CLASS } from '@/lib/ui/partner-section-rhythm'

/** Title + CSV export — period/axis live on the reports card (Stage 211.3). */
export function PartnerFinancesHeader({
  t,
  language = 'ru',
  pdfDateFrom,
  pdfDateTo,
  csvLoading = false,
  onExportCsv,
}) {
  const periodLabel = formatPartnerFinancesPeriodLabel(pdfDateFrom, pdfDateTo, language)
  const csvLabel = interpolateTemplate(t('partnerFinances_csvPeriodButton'), {
    period: periodLabel,
  })

  return (
    <PageSectionHeader
      className="mb-2"
      title={t('financesTitle')}
      subtitle={t('financesDesc')}
      titleClassName={PARTNER_HUB_PAGE_TITLE_MD_HIDE_CLASS}
      action={
        <Button
          onClick={onExportCsv}
          variant="outline"
          disabled={csvLoading}
          className="gap-2 shrink-0 self-start sm:self-auto min-h-[44px]"
          data-testid="partner-finances-header-export-csv"
          title={csvLabel}
        >
          {csvLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {csvLoading ? t('partnerFinances_csvDownloading') : csvLabel}
        </Button>
      }
    />
  )
}
