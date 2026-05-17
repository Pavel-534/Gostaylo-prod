'use client'

import Link from 'next/link'
import { AlertTriangle, HandCoins, Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { formatPrice } from '@/lib/currency'
import { formatPayoutProfileLines } from '@/lib/partner/format-payout-profile-display'

export function PartnerFinancesWithdrawDialog({
  t,
  open,
  onOpenChange,
  partnerProfileVerified,
  financesSummary,
  currency,
  exchangeRates,
  pendingPayoutPreview,
  defaultPayoutProfile,
  partnerId,
  withdrawSubmitting,
  onConfirmWithdraw,
}) {
  const profileLines = defaultPayoutProfile
    ? formatPayoutProfileLines(defaultPayoutProfile.method, defaultPayoutProfile.data)
    : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('partnerFinances_withdrawDialogTitle')}</DialogTitle>
          <DialogDescription>{t('partnerFinances_withdrawDialogDesc')}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 flex gap-2">
          <HandCoins className="h-5 w-5 shrink-0 text-amber-700 mt-0.5" />
          <p>{t('partnerFinances_withdrawManualNotice')}</p>
        </div>

        {partnerProfileVerified === false ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {t('partnerFinances_payoutKycBlockedHint')}
            <div className="mt-2">
              <Link
                href="/partner/settings"
                className="font-semibold text-amber-900 underline underline-offset-2"
              >
                {t('partnerFinances_payoutKycLinkSettings')}
              </Link>
            </div>
          </div>
        ) : null}

        <div className="space-y-3 text-sm">
          <div className="flex justify-between gap-2 border-b border-slate-200 pb-2">
            <span className="text-slate-600">{t('partnerFinances_withdrawAvailableLabel')}</span>
            <span className="font-semibold tabular-nums">
              {formatPrice(financesSummary?.availableThb ?? 0, currency, exchangeRates)}
            </span>
          </div>
          <div className="flex justify-between gap-2 border-b border-slate-200 pb-2">
            <span className="text-slate-600">{t('partnerFinances_withdrawEstimatedLabel')}</span>
            <span className="font-semibold tabular-nums text-teal-700">
              {formatPrice(pendingPayoutPreview.final, currency, exchangeRates)}
            </span>
          </div>
          <div>
            <p className="font-medium text-slate-800">{t('partnerFinances_withdrawRequisites')}</p>
            {defaultPayoutProfile ? (
              <div className="mt-1 space-y-1 rounded-md bg-slate-50 border border-slate-100 p-3 text-sm text-slate-800">
                <p className="font-medium text-slate-900">
                  {defaultPayoutProfile.method?.name || '—'}
                </p>
                {profileLines.map((line) => (
                  <p key={line} className="text-slate-700 break-all">
                    {line}
                  </p>
                ))}
              </div>
            ) : (
              <p className="mt-1 text-amber-800 flex items-start gap-1">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {t('partnerFinances_withdrawNoProfile')}
              </p>
            )}
          </div>
          {!defaultPayoutProfile ? (
            <Button variant="outline" asChild className="w-full">
              <Link href="/partner/payout-profiles">{t('partnerFinances_withdrawLinkProfiles')}</Link>
            </Button>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('partnerFinances_withdrawCancel')}
          </Button>
          <Button
            type="button"
            className="gap-2 bg-teal-600 hover:bg-teal-700"
            onClick={() => void onConfirmWithdraw()}
            disabled={
              withdrawSubmitting ||
              !partnerId ||
              partnerProfileVerified !== true ||
              !defaultPayoutProfile
            }
          >
            {withdrawSubmitting ? <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden /> : null}
            {t('partnerFinances_withdrawConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
