'use client'

/**
 * Partner Finances — Stage 54 composition + Stage 186.1 tabbed IA.
 * Data: `hooks/usePartnerFinances.js`.
 */

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { PartnerFinancialSnapshotDialog } from '@/components/partner/PartnerFinancialSnapshotDialog'
import { usePartnerFinances } from '@/hooks/usePartnerFinances'
import { PartnerFinancesHeader } from '@/components/partner/finances/PartnerFinancesHeader'
import { PartnerFinancesWithdrawDialog } from '@/components/partner/finances/PartnerFinancesWithdrawDialog'
import { PartnerFinancesTabNav } from '@/components/partner/finances/PartnerFinancesTabs'
import { PartnerFinancesOverviewTab } from '@/components/partner/finances/PartnerFinancesOverviewTab'
import { PartnerFinancesLedgerTab } from '@/components/partner/finances/PartnerFinancesLedgerTab'
import { PartnerFinancesReportsTab } from '@/components/partner/finances/PartnerFinancesReportsTab'
import { PartnerPageShell } from '@/components/product/PartnerPageShell'
import { LoadingPageShell } from '@/components/product/LoadingPageShell'
import {
  getPayoutReleaseConfig,
  getPayoutReleaseUiTexts,
  inferDominantCategorySlug,
} from '@/lib/booking/payout-release-config'
import { getSiteDisplayName } from '@/lib/site-url'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

function PartnerFinancesV2Content() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const deepLinkBookingId = searchParams.get('booking')
  const deepLinkLedgerEntryId = searchParams.get('ledgerEntry')

  const fin = usePartnerFinances()
  const {
    language,
    t,
    transactionSectionRef,
    escrowBookingFilter,
    resolvedLedgerEntry,
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
    ledgerHasMore,
    ledgerLoadingMore,
    loadMoreLedger,
    payoutPreview,
    payoutPreviewLoading,
    summaryLoadingCombined,
    handleWithdrawSubmit,
    handleExportCSV,
    handleExportPdf,
    applyPdfMonthPreset,
    payoutPreviewBatchLoading,
    getBookingPayoutPreview,
  } = fin

  const [activeTab, setActiveTab] = useState('overview')
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

  useEffect(() => {
    if (escrowBookingFilter) {
      setActiveTab('ledger')
    }
  }, [escrowBookingFilter])

  useEffect(() => {
    if (deepLinkBookingId || deepLinkLedgerEntryId) {
      setActiveTab('ledger')
    }
  }, [deepLinkBookingId, deepLinkLedgerEntryId])

  const clearQueryParam = useCallback(
    (key) => {
      if (!searchParams.get(key)) return
      const next = new URLSearchParams(searchParams.toString())
      next.delete(key)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const clearBookingDeepLink = useCallback(() => clearQueryParam('booking'), [clearQueryParam])
  const clearLedgerEntryDeepLink = useCallback(() => clearQueryParam('ledgerEntry'), [clearQueryParam])

  const payoutPolicyTexts = useMemo(() => {
    const slug = inferDominantCategorySlug(bookings)
    const config = getPayoutReleaseConfig({ categorySlug: slug })
    return getPayoutReleaseUiTexts(config, language)
  }, [bookings, language])

  const brandName = getSiteDisplayName()
  const conciergeBody = payoutPolicyTexts.conciergePayoutBody?.replace(/\{brand\}/g, brandName)

  return (
    <PartnerPageShell className="space-y-6">
      <PartnerFinancesHeader t={t} bookingsLength={bookings.length} onExportCsv={handleExportCSV} />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <PartnerFinancesTabNav t={t} documentsCount={documentsCount} />

        <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
          <PartnerFinancesOverviewTab
            t={t}
            language={language}
            payoutPolicyTexts={payoutPolicyTexts}
            financesSummary={financesSummary}
            summaryLoadingCombined={summaryLoadingCombined}
            summaryError={summaryError}
            summaryErr={summaryErr}
            onRefetchSummary={refetchSummary}
            partnerId={partnerId}
            partnerProfileVerified={partnerProfileVerified}
            defaultPayoutProfile={defaultPayoutProfile}
            payoutPreview={payoutPreview}
            payoutPreviewLoading={payoutPreviewLoading}
            onOpenWithdraw={setWithdrawOpen}
            conciergeBody={conciergeBody}
          />
        </TabsContent>

        <TabsContent value="ledger" className="mt-0 focus-visible:outline-none">
          <PartnerFinancesLedgerTab
            t={t}
            language={language}
            balanceBreakdown={balanceBreakdown}
            initialBookingId={deepLinkBookingId}
            onInitialBookingConsumed={clearBookingDeepLink}
            initialLedgerEntryId={deepLinkLedgerEntryId}
            resolvedLedgerEntry={resolvedLedgerEntry}
            onInitialLedgerEntryConsumed={clearLedgerEntryDeepLink}
            ledgerHasMore={ledgerHasMore}
            ledgerLoadingMore={ledgerLoadingMore}
            onLoadMoreLedger={loadMoreLedger}
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
        </TabsContent>

        <TabsContent value="reports" className="mt-0 focus-visible:outline-none">
          <PartnerFinancesReportsTab
            t={t}
            language={language}
            financesSummary={financesSummary}
            summaryLoadingCombined={summaryLoadingCombined}
            payoutPreviewBatchLoading={payoutPreviewBatchLoading}
            pdfDateFrom={pdfDateFrom}
            setPdfDateFrom={setPdfDateFrom}
            pdfDateTo={pdfDateTo}
            setPdfDateTo={setPdfDateTo}
            pdfLoading={pdfLoading}
            onExportPdf={handleExportPdf}
            onPresetCurrent={() => applyPdfMonthPreset('current')}
            onPresetPrev={() => applyPdfMonthPreset('prev')}
            payouts={payouts}
            payoutsLoading={payoutsLoading}
            payoutsError={payoutsError}
            payoutsErr={payoutsErr}
            onRefetchPayouts={refetchPayouts}
            payoutsInfoText={payoutPolicyTexts.payoutsInfo}
          />
        </TabsContent>
      </Tabs>

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
    </PartnerPageShell>
  )
}

export default function PartnerFinancesV2() {
  const { language } = useI18n()
  return (
    <Suspense
      fallback={
        <LoadingPageShell variant="inline" label={getUIText('partnerFinances_loading', language)} />
      }
    >
      <PartnerFinancesV2Content />
    </Suspense>
  )
}
