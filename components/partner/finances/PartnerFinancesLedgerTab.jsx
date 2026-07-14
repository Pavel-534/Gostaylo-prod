'use client'

import { useEffect, useState } from 'react'
import { PartnerFinancesLedger } from '@/components/partner/finances/PartnerFinancesLedger'
import { PartnerFinancesLedgerSubNav } from '@/components/partner/finances/PartnerFinancesLedgerSubNav'
import { PartnerFinancesTransactionHistory } from '@/components/partner/finances/PartnerFinancesTransactionHistory'

export function PartnerFinancesLedgerTab({
  t,
  language,
  balanceBreakdown,
  initialBookingId,
  onInitialBookingConsumed,
  initialLedgerEntryId,
  resolvedLedgerEntry,
  onInitialLedgerEntryConsumed,
  ledgerHasMore,
  ledgerLoadingMore,
  onLoadMoreLedger,
  transactionSectionRef,
  escrowBookingFilter,
  isLoading,
  isError,
  error,
  onRefetch,
  bookings,
  displayedBookings,
  getBookingPayoutPreview,
  payoutPreviewBatchLoading,
  hasPayoutProfile,
  onOpenSnapshot,
}) {
  const [activeSubTab, setActiveSubTab] = useState('ledger')

  useEffect(() => {
    if (escrowBookingFilter) {
      setActiveSubTab('bookings')
    }
  }, [escrowBookingFilter])

  useEffect(() => {
    if (initialLedgerEntryId) {
      setActiveSubTab('ledger')
    }
  }, [initialLedgerEntryId])

  useEffect(() => {
    if (initialBookingId) {
      setActiveSubTab('ledger')
    }
  }, [initialBookingId])

  return (
    <div className="space-y-6">
      <PartnerFinancesLedgerSubNav
        t={t}
        activeSubTab={activeSubTab}
        onSubTabChange={setActiveSubTab}
      />

      {activeSubTab === 'ledger' ? (
        <PartnerFinancesLedger
          t={t}
          language={language}
          balanceBreakdown={balanceBreakdown}
          initialBookingId={initialBookingId}
          onInitialBookingConsumed={onInitialBookingConsumed}
          initialLedgerEntryId={initialLedgerEntryId}
          resolvedLedgerEntry={resolvedLedgerEntry}
          onInitialLedgerEntryConsumed={onInitialLedgerEntryConsumed}
          ledgerHasMore={ledgerHasMore}
          ledgerLoadingMore={ledgerLoadingMore}
          onLoadMore={onLoadMoreLedger}
        />
      ) : (
        <div ref={transactionSectionRef}>
          <p className="text-sm text-slate-600 mb-4">{t('partnerFinances_ledgerBookingsIntro')}</p>
          <PartnerFinancesTransactionHistory
            t={t}
            language={language}
            transactionSectionRef={transactionSectionRef}
            escrowBookingFilter={escrowBookingFilter}
            isLoading={isLoading}
            isError={isError}
            error={error}
            onRefetch={onRefetch}
            bookings={bookings}
            displayedBookings={displayedBookings}
            getBookingPayoutPreview={getBookingPayoutPreview}
            payoutPreviewBatchLoading={payoutPreviewBatchLoading}
            hasPayoutProfile={hasPayoutProfile}
            onOpenSnapshot={onOpenSnapshot}
          />
        </div>
      )}
    </div>
  )
}
