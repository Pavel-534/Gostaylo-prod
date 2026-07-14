'use client'

import { Calendar } from 'lucide-react'
import { PartnerConciergePayoutBanner } from '@/components/partner/finances/PartnerConciergePayoutBanner'
import { PartnerFinancesBalanceStrip } from '@/components/partner/finances/PartnerFinancesBalanceStrip'
import { PartnerFinancesPayoutMathCard } from '@/components/partner/finances/PartnerFinancesPayoutMathCard'
import { PartnerFinancesStatCard } from '@/components/partner/finances/PartnerFinancesStatCard'
import { PartnerFinancesStatusAlerts } from '@/components/partner/finances/PartnerFinancesStatusAlerts'
import { PartnerFinancesWithdrawStickyCta } from '@/components/partner/finances/PartnerFinancesWithdrawStickyCta'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'

export function PartnerFinancesOverviewTab({
  t,
  language,
  brandName,
  payoutPolicyTexts,
  financesSummary,
  summaryLoadingCombined,
  summaryError,
  summaryErr,
  onRefetchSummary,
  partnerId,
  partnerProfileVerified,
  defaultPayoutProfile,
  payoutPreview,
  payoutPreviewLoading,
  onOpenWithdraw,
  conciergeBody,
}) {
  const pendingThb = financesSummary?.pendingThb ?? 0
  const hasProfile = !!defaultPayoutProfile?.id

  return (
    <div className="space-y-6 pb-2 md:pb-0">
      <PartnerConciergePayoutBanner t={t} body={conciergeBody} />

      <PartnerFinancesBalanceStrip
        t={t}
        summary={financesSummary}
        loading={summaryLoadingCombined}
        thawHoldHint={payoutPolicyTexts.thawHoldShort}
        escrowHint={payoutPolicyTexts.protected}
      />

      <PartnerFinancesStatusAlerts
        t={t}
        summaryError={summaryError}
        summaryErr={summaryErr}
        onRefetchSummary={onRefetchSummary}
        financesSummary={financesSummary}
      />

      {pendingThb > 0 ? (
        <PartnerFinancesStatCard
          icon={Calendar}
          title={t('partnerFinances_bucketPendingTitle')}
          value={<PartnerHostLedgerAmount thb={pendingThb} />}
          subtitle={t('partnerFinances_bucketPendingDesc')}
          loading={summaryLoadingCombined}
        />
      ) : null}

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
        onOpenWithdraw={onOpenWithdraw}
      />

      <PartnerFinancesWithdrawStickyCta
        t={t}
        summaryLoading={summaryLoadingCombined}
        payoutPreviewLoading={payoutPreviewLoading}
        partnerId={partnerId}
        partnerProfileVerified={partnerProfileVerified}
        hasProfile={hasProfile}
        payoutPreview={payoutPreview}
        onOpenWithdraw={onOpenWithdraw}
      />
    </div>
  )
}
