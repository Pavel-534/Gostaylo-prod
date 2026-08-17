'use client'

import { FileDown, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { interpolateTemplate } from '@/components/partner/finances/partner-payout-preview-display'
import { formatPartnerFinancesPeriodLabel } from '@/lib/partner/partner-finances-period-label'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { PARTNER_HUB_LIST_CARD_SURFACE_CLASS, PARTNER_HUB_SOFT_CARD_CONTENT_PAD_CLASS, PARTNER_HUB_SOFT_CARD_HEADER_PAD_CLASS } from '@/lib/ui/partner-section-rhythm'
import { cn } from '@/lib/utils'

export function PartnerFinancesPdfCard({
  t,
  language = 'ru',
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
}) {
  const busy = Boolean(exportLoading || pdfLoading || csvLoading)
  const pdfBusy = exportLoading === 'pdf' || pdfLoading
  const csvBusy = exportLoading === 'csv' || csvLoading
  const periodLabel = formatPartnerFinancesPeriodLabel(pdfDateFrom, pdfDateTo, language)
  const csvLabel = interpolateTemplate(t('partnerFinances_csvPeriodButton'), {
    period: periodLabel,
  })

  return (
    <Card
      className={cn(
        MOBILE_FLAT_CARD_CLASS,
        PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
        'sm:border-slate-200 sm:bg-slate-50/40',
      )}
      data-testid="partner-finances-period-controller"
    >
      <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, PARTNER_HUB_SOFT_CARD_HEADER_PAD_CLASS, 'sm:pb-2')}>
        <CardTitle className="text-base">{t('partnerFinances_pdfSectionTitle')}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">{t('partnerFinances_pdfSectionDesc')}</CardDescription>
      </CardHeader>
      <CardContent
        className={cn(
          MOBILE_FLAT_CARD_CONTENT_CLASS,
          PARTNER_HUB_SOFT_CARD_CONTENT_PAD_CLASS,
          'flex flex-col gap-3',
        )}
      >
        <div className="space-y-1">
          <Label id="partner-export-axis-label" className="text-xs text-slate-600">
            {t('partnerFinances_exportAxisLabel')}
          </Label>
          <ToggleGroup
            type="single"
            value={exportAxis}
            onValueChange={(value) => {
              if (value === 'created' || value === 'checkout') setExportAxis(value)
            }}
            aria-labelledby="partner-export-axis-label"
            className="flex flex-wrap justify-start gap-2"
            data-testid="partner-finances-export-axis"
          >
            <ToggleGroupItem
              value="created"
              variant="outline"
              className="min-h-[44px] min-w-[44px] px-3 data-[state=on]:border-brand/40 data-[state=on]:bg-brand/10 data-[state=on]:text-brand"
            >
              {t('partnerFinances_exportAxisCreated')}
            </ToggleGroupItem>
            <ToggleGroupItem
              value="checkout"
              variant="outline"
              className="min-h-[44px] min-w-[44px] px-3 data-[state=on]:border-brand/40 data-[state=on]:bg-brand/10 data-[state=on]:text-brand"
            >
              {t('partnerFinances_exportAxisCheckout')}
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1">
              <Label htmlFor="partner-pdf-from" className="text-xs text-slate-600">
                {t('partnerFinances_pdfFrom')}
              </Label>
              <Input
                id="partner-pdf-from"
                type="date"
                value={pdfDateFrom}
                onChange={(e) => setPdfDateFrom(e.target.value)}
                className="w-[11.5rem] bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="partner-pdf-to" className="text-xs text-slate-600">
                {t('partnerFinances_pdfTo')}
              </Label>
              <Input
                id="partner-pdf-to"
                type="date"
                value={pdfDateTo}
                onChange={(e) => setPdfDateTo(e.target.value)}
                className="w-[11.5rem] bg-white"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="text-xs min-h-[44px]" onClick={onPresetCurrent}>
                {t('partnerFinances_pdfThisMonth')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="text-xs min-h-[44px]" onClick={onPresetPrev}>
                {t('partnerFinances_pdfPrevMonth')}
              </Button>
              <Button type="button" variant="outline" size="sm" className="text-xs min-h-[44px]" onClick={onPresetQuarter}>
                {t('partnerFinances_pdfThisQuarter')}
              </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="gap-2 shrink-0 min-h-[44px]"
                disabled={busy}
                onClick={() => void onExportCsv?.()}
                data-testid="partner-finances-export-csv"
              >
                {csvBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileDown className="h-4 w-4" aria-hidden />
                )}
                {csvBusy ? t('partnerFinances_csvDownloading') : csvLabel}
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="gap-2 shrink-0 border-brand/25 bg-white hover:bg-brand/10 min-h-[44px]"
                disabled={busy}
                onClick={() => void onExportPdf()}
                data-testid="partner-finances-export-pdf"
              >
                {pdfBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <FileDown className="h-4 w-4" aria-hidden />
                )}
                {pdfBusy ? t('partnerFinances_pdfDownloading') : t('partnerFinances_pdfDownload')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
