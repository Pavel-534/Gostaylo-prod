'use client'

import { PageSectionHeader } from '@/components/product/PageSectionHeader'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Title + CSV export only — escrow buckets live in BalanceStrip (Stage 186.1). */
export function PartnerFinancesHeader({ t, bookingsLength, onExportCsv }) {
  return (
    <PageSectionHeader
      className="mb-2"
      title={t('financesTitle')}
      subtitle={t('financesDesc')}
      action={
        <Button
          onClick={onExportCsv}
          variant="outline"
          disabled={bookingsLength === 0}
          className="gap-2 shrink-0 self-start sm:self-auto min-h-[44px]"
        >
          <Download className="h-4 w-4" />
          {t('exportCSV')}
        </Button>
      }
    />
  )
}
