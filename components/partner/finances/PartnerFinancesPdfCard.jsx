'use client'

import { FileDown, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function PartnerFinancesPdfCard({
  t,
  pdfDateFrom,
  setPdfDateFrom,
  pdfDateTo,
  setPdfDateTo,
  pdfLoading,
  onExportPdf,
  onPresetCurrent,
  onPresetPrev,
}) {
  return (
    <Card className="border-slate-200 bg-slate-50/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('partnerFinances_pdfSectionTitle')}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">{t('partnerFinances_pdfSectionDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={onPresetCurrent}>
              {t('partnerFinances_pdfThisMonth')}
            </Button>
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={onPresetPrev}>
              {t('partnerFinances_pdfPrevMonth')}
            </Button>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="gap-2 shrink-0 border-teal-200 bg-white hover:bg-teal-50"
            disabled={pdfLoading}
            onClick={() => void onExportPdf()}
          >
            {pdfLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <FileDown className="h-4 w-4" aria-hidden />
            )}
            {pdfLoading ? t('partnerFinances_pdfDownloading') : t('partnerFinances_pdfDownload')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
