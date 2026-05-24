'use client'

import { formatPrice } from '@/lib/currency'
import {
  buildPayoutReceiveRateLine,
  interpolateTemplate,
} from '@/components/partner/finances/partner-payout-preview-display'

/**
 * Server-driven payout preview (GET /api/v2/partner/payouts/preview → partner-payout-fx).
 */
export function PartnerPayoutPreviewFields({
  t,
  language = 'ru',
  preview,
  loading = false,
  financesSummary,
  variant = 'card',
}) {
  const availableThb = preview?.availableThb ?? financesSummary?.availableThb ?? 0
  const reservedThb = preview?.pendingPayoutReserveThb ?? financesSummary?.pendingPayoutReserveThb ?? 0
  const rateLine = buildPayoutReceiveRateLine(t, preview, language)
  const isDialog = variant === 'dialog'

  return (
    <div className={isDialog ? 'rounded-md border border-brand/20 bg-brand/10 p-3 space-y-2' : 'space-y-2'}>
      <div className="flex justify-between gap-3 min-w-0">
        <span className="text-slate-600 shrink-0">{t('partnerFinances_payoutMathBaseAvailable')}</span>
        <span className="font-medium tabular-nums text-right break-all min-w-0">
          {loading ? '…' : formatPrice(availableThb, 'THB')}
        </span>
      </div>

      {reservedThb > 0 ? (
        <p className="text-xs text-slate-500">
          {interpolateTemplate(t('partnerFinances_withdrawReservedHint'), {
            amount: formatPrice(reservedThb, 'THB'),
          })}
        </p>
      ) : null}

      <div className="flex justify-between gap-3 min-w-0">
        <span className="text-slate-600 shrink-0">{t('partnerFinances_payoutMathFee')}</span>
        <span className="font-medium tabular-nums text-right break-all min-w-0 text-amber-800">
          {loading ? '…' : `−${formatPrice(preview?.feeAmountThb ?? 0, 'THB')}`}
        </span>
      </div>

      <div className={`flex flex-col gap-1 min-w-0 ${isDialog ? '' : 'pt-2 border-t border-indigo-200'}`}>
        <div className="flex justify-between gap-3">
          <span className={isDialog ? 'text-slate-600 shrink-0' : 'font-semibold shrink-0'}>
            {t('partnerFinances_payoutMathFinal')}
          </span>
          <span
            className={`tabular-nums text-right break-all min-w-0 font-semibold ${
              isDialog ? 'text-brand-hover' : 'text-indigo-700'
            }`}
          >
            {loading ? '…' : formatPrice(preview?.finalAmountThb ?? 0, 'THB')}
          </span>
        </div>
        {rateLine ? (
          <p className={`text-sm font-medium ${isDialog ? 'text-brand' : 'text-indigo-800'}`}>
            {rateLine}
          </p>
        ) : null}
        {!loading && preview?.amountInPayoutCurrency != null && preview?.payoutCurrency ? (
          <p className="text-xs text-slate-600">{t('partnerFinances_rubIndicativeDisclaimer')}</p>
        ) : null}
      </div>
    </div>
  )
}
