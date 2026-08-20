'use client'

/**
 * Stage 131.A5.D — entry CTA from referral hub / status → wallet payout flow.
 * Uses SSOT min payout (THB) from wallet/me — never hardcodes ₽2600.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { Landmark, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { cn } from '@/lib/utils'

function hasRuProfileBlocker(blockerDetails) {
  const rows = Array.isArray(blockerDetails) ? blockerDetails : []
  return rows.some((b) => {
    const code = String(b?.code || '')
    return (
      code.startsWith('REFERRAL_RU_PAYOUT_PROFILE') ||
      code === 'REFERRAL_RU_INN_CHECKSUM_INVALID'
    )
  })
}

/**
 * @param {{
 *   walletData?: object | null,
 *   className?: string,
 *   size?: 'default' | 'sm',
 * }} props
 */
export function ReferralWithdrawEntryCta({ walletData = null, className = '', size = 'default' }) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const { formatMinPayoutThreshold } = useReferralLedgerDisplay()

  const payout = walletData?.payout || null
  const withdrawableThb = Number(
    walletData?.balances?.withdrawableBalanceThb ??
      walletData?.wallet?.withdrawable_balance_thb ??
      0,
  )
  const minPayoutThb = (() => {
    const n = Number(payout?.minPayoutThb ?? walletData?.policy?.walletMinPayoutThb)
    return Number.isFinite(n) && n > 0 ? n : 1000
  })()
  const minLabel = formatMinPayoutThreshold(minPayoutThb)
  const blockerDetails = Array.isArray(payout?.blockerDetails) ? payout.blockerDetails : []
  const needsRuProfile = hasRuProfileBlocker(blockerDetails)
  const belowMin = withdrawableThb < minPayoutThb
  const eligible = payout?.payoutEligible === true
  const requested = payout?.referralWithdrawalStatus === 'withdrawable_referral'

  if (requested) {
    return (
      <Button
        asChild
        variant="outline"
        className={cn('min-h-[44px] w-full', className)}
        data-testid="referral-withdraw-entry-queued"
      >
        <Link href="/profile/wallet">{t('stage131a5_withdrawCtaQueued')}</Link>
      </Button>
    )
  }

  if (needsRuProfile) {
    return (
      <Button
        asChild
        variant="brand"
        className={cn('min-h-[44px] w-full', className)}
        data-testid="referral-withdraw-entry-setup"
      >
        <Link href="/profile/wallet?action=payout-setup">
          <Landmark className="mr-2 h-4 w-4" />
          {t('stage131a5_withdrawCtaSetupRu')}
        </Link>
      </Button>
    )
  }

  if (belowMin || !eligible) {
    return (
      <div className={cn('flex w-full flex-col gap-1', className)}>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full"
              data-testid="referral-withdraw-entry-below-min"
            >
              <Wallet className="mr-2 h-4 w-4" />
              {t('stage131a5_withdrawCtaBelowMin', { minAmount: minLabel })}
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" className="max-w-xs text-xs leading-snug">
            {t('stage131a5_withdrawCtaBelowMinHint', { minAmount: minLabel })}
          </PopoverContent>
        </Popover>
        <Button asChild variant="link" className="h-auto min-h-[44px] p-0 text-sm">
          <Link href="/profile/wallet">{t('stage131a5_withdrawCtaOpenWallet')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <Button
      asChild
      variant="brand"
      size={size}
      className={cn('min-h-[44px] w-full', className)}
      data-testid="referral-withdraw-entry-request"
    >
      <Link href="/profile/wallet?action=withdraw">
        <Wallet className="mr-2 h-4 w-4" />
        {t('stage131a5_withdrawCtaRequest')}
      </Link>
    </Button>
  )
}

export default ReferralWithdrawEntryCta
