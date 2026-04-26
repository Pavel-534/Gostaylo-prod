'use client'

/**
 * GoStayLo Partner Finances — composition shell (Stage 54.0).
 * Data: `hooks/usePartnerFinances.js`. UI: `components/partner/finances/*`.
 */

import { Suspense } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Shield, Wallet, Banknote, Clock, Loader2 } from 'lucide-react'
import { formatPrice } from '@/lib/currency'
import { PartnerFinancialSnapshotDialog } from '@/components/partner/PartnerFinancialSnapshotDialog'
import { usePartnerFinances } from '@/hooks/usePartnerFinances'
import { PartnerFinancesHeader } from '@/components/partner/finances/PartnerFinancesHeader'
import { PartnerFinancesPdfCard } from '@/components/partner/finances/PartnerFinancesPdfCard'
import { PartnerFinancesStatCard } from '@/components/partner/finances/PartnerFinancesStatCard'
import { PartnerFinancesPayoutHistory } from '@/components/partner/finances/PartnerFinancesPayoutHistory'
import { PartnerFinancesLedger } from '@/components/partner/finances/PartnerFinancesLedger'
import { PartnerFinancesPayoutMathCard } from '@/components/partner/finances/PartnerFinancesPayoutMathCard'
import { PartnerFinancesTransactionHistory } from '@/components/partner/finances/PartnerFinancesTransactionHistory'
import { PartnerFinancesWithdrawDialog } from '@/components/partner/finances/PartnerFinancesWithdrawDialog'

function PartnerFinancesV2Content() {
  const fin = usePartnerFinances()
  const {
    language,
    t,
    transactionSectionRef,
    escrowBookingFilter,
    partnerId,
    currency,
    exchangeRates,
    defaultPayoutProfile,
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
    pendingPayoutPreview,
    summaryLoadingCombined,
    handleWithdrawSubmit,
    handleExportCSV,
    handleExportPdf,
    applyPdfMonthPreset,
    calcPayoutMath,
  } = fin

  return (
    <div className="space-y-8 min-w-0 max-w-full">
      <PartnerFinancesHeader
        t={t}
        balanceBreakdown={balanceBreakdown}
        bookingsLength={bookings.length}
        onExportCsv={handleExportCSV}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PartnerFinancesStatCard
          icon={Calendar}
          title={t('partnerFinances_bucketPendingTitle')}
          value={formatPrice(financesSummary?.pendingThb ?? 0, currency, exchangeRates)}
          subtitle={t('partnerFinances_bucketPendingDesc')}
          loading={summaryLoadingCombined}
        />
        <PartnerFinancesStatCard
          icon={Shield}
          title={t('partnerFinances_bucketEscrowTitle')}
          value={formatPrice(financesSummary?.escrowThb ?? 0, currency, exchangeRates)}
          subtitle={t('partnerFinances_bucketEscrowDesc')}
          loading={summaryLoadingCombined}
        />
        <PartnerFinancesStatCard
          icon={Wallet}
          title={t('partnerFinances_bucketAvailableTitle')}
          value={formatPrice(financesSummary?.availableThb ?? 0, currency, exchangeRates)}
          subtitle={t('partnerFinances_bucketAvailableDesc')}
          loading={summaryLoadingCombined}
        />
        <PartnerFinancesStatCard
          icon={Banknote}
          title={t('partnerFinances_bucketTotalPaidTitle')}
          value={formatPrice(financesSummary?.totalPaidThb ?? 0, currency, exchangeRates)}
          subtitle={t('partnerFinances_bucketTotalPaidDesc')}
          loading={summaryLoadingCombined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              {t('partnerFinances_portfolioGrossTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-900">
              {summaryLoadingCombined
                ? '—'
                : formatPrice(financesSummary?.portfolio?.grossThb ?? 0, currency, exchangeRates)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {financesSummary?.portfolio?.bookingCount ?? 0} {t('partnerFinances_portfolioBookingsLabel')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              {t('partnerFinances_portfolioFeeTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {summaryLoadingCombined
                ? '—'
                : formatPrice(financesSummary?.portfolio?.feeThb ?? 0, currency, exchangeRates)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              {t('partnerFinances_portfolioNetTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {summaryLoadingCombined
                ? '—'
                : formatPrice(financesSummary?.portfolio?.netThb ?? 0, currency, exchangeRates)}
            </div>
          </CardContent>
        </Card>
      </div>

      <PartnerFinancesPayoutHistory
        t={t}
        language={language}
        payouts={payouts}
        payoutsLoading={payoutsLoading}
        payoutsError={payoutsError}
        payoutsErr={payoutsErr}
        onRefetchPayouts={refetchPayouts}
        exchangeRates={exchangeRates}
      />

      <PartnerFinancesLedger t={t} balanceBreakdown={balanceBreakdown} />

      <PartnerFinancesPayoutMathCard
        t={t}
        currency={currency}
        exchangeRates={exchangeRates}
        financesSummary={financesSummary}
        summaryLoading={summaryLoadingCombined}
        partnerId={partnerId}
        partnerProfileVerified={partnerProfileVerified}
        defaultPayoutProfile={defaultPayoutProfile}
        pendingPayoutPreview={pendingPayoutPreview}
        onOpenWithdraw={setWithdrawOpen}
      />

      <PartnerFinancesTransactionHistory
        t={t}
        currency={currency}
        exchangeRates={exchangeRates}
        transactionSectionRef={transactionSectionRef}
        escrowBookingFilter={escrowBookingFilter}
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRefetch={refetch}
        bookings={bookings}
        displayedBookings={displayedBookings}
        calcPayoutMath={calcPayoutMath}
        onOpenSnapshot={setFinanceFocusBooking}
      />

      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">{t('howPayoutsWork')}</h4>
              <p className="text-sm text-blue-700">{t('payoutsInfo')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <PartnerFinancesWithdrawDialog
        t={t}
        open={withdrawOpen}
        onOpenChange={setWithdrawOpen}
        partnerProfileVerified={partnerProfileVerified}
        financesSummary={financesSummary}
        currency={currency}
        exchangeRates={exchangeRates}
        pendingPayoutPreview={pendingPayoutPreview}
        defaultPayoutProfile={defaultPayoutProfile}
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
    </div>
  )
}

export default function PartnerFinancesV2() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" aria-label="Загрузка" />
        </div>
      }
    >
      <PartnerFinancesV2Content />
    </Suspense>
  )
}
