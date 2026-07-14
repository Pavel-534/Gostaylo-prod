'use client'

import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { PartnerHostLedgerAmount } from '@/components/partner/finances/partner-host-amount-display'

function showPartnerReconciliationDebug() {
  return process.env.NEXT_PUBLIC_PARTNER_FINANCE_DEBUG === '1'
}

export function PartnerFinancesStatusAlerts({
  t,
  summaryError,
  summaryErr,
  onRefetchSummary,
  financesSummary,
}) {
  return (
    <>
      {summaryError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {summaryErr?.message}
          <Button variant="outline" size="sm" className="ml-2" onClick={() => onRefetchSummary()}>
            {t('retry')}
          </Button>
        </div>
      ) : null}

      {financesSummary?.reconciliation && !financesSummary.reconciliation.withinTolerance ? (
        showPartnerReconciliationDebug() ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900">
            {t('partnerFinances_reconciliationWarn')}
            <span className="ml-2 font-mono text-xs">
              Δ <PartnerHostLedgerAmount thb={financesSummary.reconciliation.differenceThb ?? 0} />
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {t('partnerFinances_reconciliationCalm')}
          </div>
        )
      ) : financesSummary?.reconciliation?.withinTolerance ? (
        <p className="text-xs text-slate-500">{t('partnerFinances_reconciliationOk')}</p>
      ) : null}

      {(financesSummary?.disputeHoldThb ?? 0) > 0 ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 flex gap-2 items-start">
          <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
          <span>{t('partnerFinances_disputeBanner')}</span>
        </div>
      ) : null}
    </>
  )
}
