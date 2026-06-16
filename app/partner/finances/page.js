'use client'

/**
 * GoStayLo Partner Finances — composition shell (Stage 54.0).
 * Data: `hooks/usePartnerFinances.js`. UI: `components/partner/finances/*`.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Clock, AlertTriangle, FileText } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { PartnerFinancialSnapshotDialog } from '@/components/partner/PartnerFinancialSnapshotDialog'
import { usePartnerFinances } from '@/hooks/usePartnerFinances'
import { PartnerFinancesHeader } from '@/components/partner/finances/PartnerFinancesHeader'
import { PartnerFinancesPdfCard } from '@/components/partner/finances/PartnerFinancesPdfCard'
import { PartnerFinancesStatCard } from '@/components/partner/finances/PartnerFinancesStatCard'
import { PartnerFinancesPortfolioCards } from '@/components/partner/finances/PartnerFinancesPortfolioCards'
import { PartnerFinancesPayoutHistory } from '@/components/partner/finances/PartnerFinancesPayoutHistory'
import { PartnerFinancesLedger } from '@/components/partner/finances/PartnerFinancesLedger'
import { PartnerFinancesPayoutMathCard } from '@/components/partner/finances/PartnerFinancesPayoutMathCard'
import { PartnerFinancesTransactionHistory } from '@/components/partner/finances/PartnerFinancesTransactionHistory'
import { PartnerFinancesWithdrawDialog } from '@/components/partner/finances/PartnerFinancesWithdrawDialog'
import { PartnerFinancesBalanceStrip } from '@/components/partner/finances/PartnerFinancesBalanceStrip'
import { PartnerFinancesDocuments } from '@/components/partner/finances/PartnerFinancesDocuments'
import { PartnerConciergePayoutBanner } from '@/components/partner/finances/PartnerConciergePayoutBanner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { LoadingPageShell } from '@/components/product/LoadingPageShell'
import {
  getPayoutReleaseConfig,
  getPayoutReleaseUiTexts,
  inferDominantCategorySlug,
} from '@/lib/booking/payout-release-config'
import { getSiteDisplayName } from '@/lib/site-url'

function PartnerFinancesV2Content() {
  const fin = usePartnerFinances()
  const {
    language,
    t,
    transactionSectionRef,
    escrowBookingFilter,
    partnerId,
    defaultPayoutProfile,
    payoutProfiles,
    pdfDateFrom,
    setPdfDateFrom,
    pdfDateTo,
    setPdfDateTo,
    pdfLoading,
    financeFocusBooking,
    setFinanceFocusBooking,
    withdrawOpen,
    setWithdrawOpen,
    withdrawSubmitting,
    partnerProfileVerified,
    bookings,
    displayedBookings,
    isLoading,
    isError,
    error,
    refetch,
    financesSummary,
    summaryError,
    summaryErr,
    refetchSummary,
    payouts,
    payoutsLoading,
    payoutsError,
    payoutsErr,
    refetchPayouts,
    balanceBreakdown,
    payoutPreview,
    payoutPreviewLoading,
    summaryLoadingCombined,
    handleWithdrawSubmit,
    handleExportCSV,
    handleExportPdf,
    applyPdfMonthPreset,
    payoutPreviewByAmountKey,
    payoutPreviewBatchLoading,
    getBookingPayoutPreview,
  } = fin

  const [documentsCount, setDocumentsCount] = useState(null)
  const loadDocumentsCount = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/partner/settlement-documents', { cache: 'no-store' })
      const json = await res.json()
      if (res.ok && json.success) {
        setDocumentsCount((json.data?.documents || []).length)
      }
    } catch {
      setDocumentsCount(null)
    }
  }, [])

  useEffect(() => {
    loadDocumentsCount()
  }, [loadDocumentsCount])

  const payoutPolicyTexts = useMemo(() => {
    const slug = inferDominantCategorySlug(bookings)
    const config = getPayoutReleaseConfig({ categorySlug: slug })
    return getPayoutReleaseUiTexts(config, language)
  }, [bookings, language])

  const brandName = getSiteDisplayName()

  return (
    <div className="space-y-8 min-w-0 max-w-full">
      <PartnerFinancesHeader
        t={t}
        balanceBreakdown={balanceBreakdown}
        bookingsLength={bookings.length}
        onExportCsv={handleExportCSV}
        escrowCardDesc={payoutPolicyTexts.escrowCard}
      />

      <PartnerConciergePayoutBanner
        t={t}
        body={payoutPolicyTexts.conciergePayoutBody?.replace(/\{brand\}/g, brandName)}
      />

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/60 p-1">
          <TabsTrigger
            value="documents"
            className={cn(
              'gap-1.5 order-first font-semibold ring-2 ring-brand/40 data-[state=active]:bg-brand data-[state=active]:text-white',
              documentsCount > 0 && 'data-[state=inactive]:bg-brand/10 animate-pulse',
            )}
          >
            <FileText className="h-4 w-4" />
            {t('partnerFinances_tabDocuments')}
            {documentsCount != null && documentsCount > 0 ? (
              <Badge variant="secondary" className="ml-1 bg-brand/15 text-brand">
                {documentsCount}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="overview">{t('partnerFinances_tabOverview')}</TabsTrigger>
        </TabsList>

        {documentsCount === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground rounded-lg border border-dashed border-brand/25 bg-brand/10 px-3 py-2">
            {t('partnerFinances_docsTabHint')}
          </p>
        ) : null}

        <TabsContent value="documents" className="mt-6">
          <PartnerFinancesDocuments t={t} language={language} />
        </TabsContent>

        <TabsContent value="overview" className="space-y-8 mt-6">
      <PartnerFinancesBalanceStrip
        t={t}
        summary={financesSummary}
        loading={summaryLoadingCombined}
        thawHoldHint={payoutPolicyTexts.thawHoldShort}
        escrowHint={payoutPolicyTexts.protected}
      />

      <PartnerFinancesPdfCard
        t={t}
        pdfDateFrom={pdfDateFrom}
        setPdfDateFrom={setPdfDateFrom}
        pdfDateTo={pdfDateTo}
        setPdfDateTo={setPdfDateTo}
        pdfLoading={pdfLoading}
        onExportPdf={handleExportPdf}
        onPresetCurrent={() => applyPdfMonthPreset('current')}
        onPresetPrev={() => applyPdfMonthPreset('prev')}
      />

      {summaryError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {summaryErr?.message}
          <Button variant="outline" size="sm" className="ml-2" onClick={() => refetchSummary()}>
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {financesSummary?.reconciliation && !financesSummary.reconciliation.withinTolerance ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
          {t('partnerFinances_reconciliationWarn')}
          <span className="ml-2 font-mono text-xs">
            Δ {formatPrice(financesSummary.reconciliation.differenceThb ?? 0, 'THB')}
          </span>
        </div>
      ) : financesSummary?.reconciliation?.withinTolerance ? (
        <p className="text-xs text-slate-500">{t('partnerFinances_reconciliationOk')}</p>
      ) : null}

      {(financesSummary?.disputeHoldThb ?? 0) > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 flex gap-2 items-start">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <span>{t('partnerFinances_disputeBanner')}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PartnerFinancesStatCard
          icon={Calendar}
          title={t('partnerFinances_bucketPendingTitle')}
          value={formatPrice(financesSummary?.pendingThb ?? 0, 'THB')}
          subtitle={t('partnerFinances_bucketPendingDesc')}
          loading={summaryLoadingCombined}
        />
        <PartnerFinancesStatCard
          icon={AlertTriangle}
          title={t('partnerFinances_bucketDisputeTitle')}
          value={formatPrice(financesSummary?.disputeHoldThb ?? 0, 'THB')}
          subtitle={t('partnerFinances_bucketDisputeDesc')}
          loading={summaryLoadingCombined}
        />
      </div>

      <PartnerFinancesPortfolioCards
        t={t}
        language={language}
        financesSummary={financesSummary}
        loading={summaryLoadingCombined || payoutPreviewBatchLoading}
        previewByAmountKey={payoutPreviewByAmountKey}
      />

      <PartnerFinancesPayoutHistory
        t={t}
        language={language}
        payouts={payouts}
        payoutsLoading={payoutsLoading}
        payoutsError={payoutsError}
        payoutsErr={payoutsErr}
        onRefetchPayouts={refetchPayouts}
      />

      <PartnerFinancesLedger t={t} balanceBreakdown={balanceBreakdown} />

      <PartnerFinancesPayoutMathCard
        t={t}
        language={language}
        financesSummary={financesSummary}
        summaryLoading={summaryLoadingCombined}
        partnerId={partnerId}
        partnerProfileVerified={partnerProfileVerified}
        defaultPayoutProfile={defaultPayoutProfile}
        payoutPreview={payoutPreview}
        payoutPreviewLoading={payoutPreviewLoading}
        onOpenWithdraw={setWithdrawOpen}
      />

      <PartnerFinancesTransactionHistory
        t={t}
        language={language}
        transactionSectionRef={transactionSectionRef}
        escrowBookingFilter={escrowBookingFilter}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRefetch={refetch}
        bookings={bookings}
        displayedBookings={displayedBookings}
        getBookingPayoutPreview={getBookingPayoutPreview}
        payoutPreviewBatchLoading={payoutPreviewBatchLoading}
        hasPayoutProfile={!!defaultPayoutProfile?.id}
        onOpenSnapshot={setFinanceFocusBooking}
      />

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">{t('howPayoutsWork')}</h4>
              <p className="text-sm text-blue-700">{payoutPolicyTexts.payoutsInfo}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <PartnerFinancesWithdrawDialog
        t={t}
        language={language}
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        partnerProfileVerified={partnerProfileVerified}
        financesSummary={financesSummary}
        payoutProfiles={payoutProfiles}
        partnerId={partnerId}
        withdrawSubmitting={withdrawSubmitting}
        onConfirmWithdraw={handleWithdrawSubmit}
      />

      <PartnerFinancialSnapshotDialog
        open={!!financeFocusBooking}
        onOpenChange={(open) => {
          if (!open) setFinanceFocusBooking(null)
        }}
        snapshot={financeFocusBooking?.financial_snapshot}
        bookingTitle={financeFocusBooking?.listing?.title || t('listing')}
        bookingId={String(financeFocusBooking?.id || '')}
        status={financeFocusBooking?.status}
        language={language}
      />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function PartnerFinancesV2() {
  return (
    <Suspense fallback={<LoadingPageShell variant="inline" label="Loading…" />}>
      <PartnerFinancesV2Content />
    </Suspense>
  )
}
