'use client'

import { useEffect, useState } from 'react'
import { PartnerFinancesLedger } from '@/components/partner/finances/PartnerFinancesLedger'
import { PartnerFinancesLedgerSubNav } from '@/components/partner/finances/PartnerFinancesLedgerSubNav'
import { PartnerFinancesTransactionHistory } from '@/components/partner/finances/PartnerFinancesTransactionHistory'
import { PartnerSectionDivider } from '@/components/partner/PartnerSectionDivider'
import { PARTNER_SECTION_TITLE_CLASS } from '@/lib/ui/partner-section-rhythm'

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
    <div className="space-y-0">
      <PartnerFinancesLedgerSubNav
        t={t}
        activeSubTab={activeSubTab}
        onSubTabChange={setActiveSubTab}
      />

      <PartnerSectionDivider />

      {activeSubTab === 'ledger' ? (
        <section data-partner-section="finances-ledger" className="space-y-3">
          <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerFinances_ledgerTitle')}</h2>
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
        </section>
      ) : (
        <section
          ref={transactionSectionRef}
          data-partner-section="finances-transactions"
          className="space-y-3"
        >
          <h2 className={PARTNER_SECTION_TITLE_CLASS}>{t('partnerFinances_sectionTransactions')}</h2>
          <p className="text-xs leading-relaxed text-slate-500">{t('partnerFinances_ledgerBookingsIntro')}</p>
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
        </section>
      )}
    </div>
  )
}
