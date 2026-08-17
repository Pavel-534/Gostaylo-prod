'use client'

import { useState } from 'react'
import { Download, FileText, Info, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'
import { useToast } from '@/hooks/use-toast'
import { fetchPartnerSettlementDocumentDownloadUrl } from '@/lib/api/partner-finances-client'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import {
  PARTNER_HUB_LIST_CARD_SURFACE_CLASS,
  PARTNER_HUB_SOFT_CARD_CONTENT_PAD_CLASS,
  PARTNER_HUB_SOFT_CARD_HEADER_PAD_CLASS,
  PARTNER_HUB_SOFT_CARD_PAD_CLASS,
} from '@/lib/ui/partner-section-rhythm'
import { cn } from '@/lib/utils'

function Metric({ title, thb, loading, valueClassName }) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-200/80 bg-white px-3 py-3">
      <p className="text-xs font-medium text-slate-600">{title}</p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums sm:text-2xl', valueClassName)}>
        {loading ? '—' : <PartnerHostLedgerAmount thb={thb ?? 0} />}
      </p>
    </div>
  )
}

/**
 * Stage 211.2 — period pack (earned vs paid) + closing acts for the selected range.
 */
export function PartnerFinancesPeriodPackCard({
  t,
  pack,
  loading,
  error,
  onRetry,
  archiveOpen = false,
  onToggleArchive,
}) {
  const { toast } = useToast()
  const [downloadingId, setDownloadingId] = useState(null)
  const docs = pack?.linkedSettlementDocs || []

  const sourceLabel = (s) =>
    s === 'batch' ? t('partnerFinances_docsSourceBatch') : t('partnerFinances_docsSourcePayout')

  const handleDownload = async (row) => {
    setDownloadingId(row.id)
    try {
      const signedUrl = await fetchPartnerSettlementDocumentDownloadUrl({
        source: row.source,
        refId: row.refId,
      })
      if (!signedUrl) throw new Error('download_failed')
      window.open(signedUrl, '_blank', 'noopener,noreferrer')
    } catch (e) {
      toast({
        title: t('partnerFinances_docsDownloadError'),
        description: e?.message,
        variant: 'destructive',
      })
    } finally {
      setDownloadingId(null)
    }
  }

  return (
    <Card
      className={cn(MOBILE_FLAT_CARD_CLASS, PARTNER_HUB_LIST_CARD_SURFACE_CLASS)}
      data-testid="partner-finances-period-pack"
    >
      <CardHeader className={cn(MOBILE_FLAT_CARD_HEADER_CLASS, PARTNER_HUB_SOFT_CARD_HEADER_PAD_CLASS, 'sm:pb-2')}>
        <CardTitle className="text-base">{t('partnerFinances_periodPackTitle')}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {t('partnerFinances_periodPackDesc')}
          {pack?.fromYmd && pack?.toYmd ? ` ${pack.fromYmd} → ${pack.toYmd}.` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, PARTNER_HUB_SOFT_CARD_CONTENT_PAD_CLASS, 'space-y-4')}>
        {error ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-red-700">{t('partnerFinances_periodPackError')}</p>
            <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => void onRetry?.()}>
              {t('retry')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric title={t('partnerFinances_periodGross')} thb={pack?.totalGrossThb} loading={loading} valueClassName="text-slate-900" />
            <Metric title={t('partnerFinances_periodFee')} thb={pack?.totalCommissionThb} loading={loading} valueClassName="text-red-700" />
            <Metric title={t('partnerFinances_periodNet')} thb={pack?.totalNetEarnedThb} loading={loading} valueClassName="text-emerald-700" />
            <Metric title={t('partnerFinances_periodPaid')} thb={pack?.totalPaidOutThb} loading={loading} valueClassName="text-slate-900" />
          </div>
        )}

        {!loading && !error ? (
          <div
            className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50/80 px-3 py-3"
            data-testid="partner-finances-earned-vs-paid-hint"
          >
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" aria-hidden />
            <p className="text-sm leading-relaxed text-sky-950">{t('partnerFinances_periodEarnedVsPaidHint')}</p>
          </div>
        ) : null}

        <div className={cn(PARTNER_HUB_SOFT_CARD_PAD_CLASS, 'rounded-2xl border border-slate-200/80 bg-slate-50/60')}>
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FileText className="h-4 w-4 text-brand-hover" aria-hidden />
            {t('partnerFinances_periodDocsTitle')}
          </p>
          {loading ? (
            <p className="text-sm text-slate-500">{t('partnerFinances_loading')}</p>
          ) : docs.length === 0 ? (
            <p className="text-sm text-slate-500">{t('partnerFinances_periodDocsEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-2 rounded-xl bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm break-all">{row.documentNo}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {sourceLabel(row.source)}
                      </Badge>
                      <span className="text-xs tabular-nums text-slate-600">
                        <PartnerHostLedgerAmount thb={row.amountThb ?? 0} />
                      </span>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-[44px] shrink-0"
                    disabled={downloadingId === row.id}
                    onClick={() => void handleDownload(row)}
                  >
                    {downloadingId === row.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-1" />
                        {t('partnerFinances_docsDownload')}
                      </>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {onToggleArchive ? (
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-[44px] w-full sm:w-auto"
              onClick={onToggleArchive}
              data-testid="partner-finances-docs-archive-cta"
              aria-expanded={archiveOpen}
            >
              {archiveOpen ? t('partnerFinances_docsArchiveHide') : t('partnerFinances_docsArchiveCta')}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
