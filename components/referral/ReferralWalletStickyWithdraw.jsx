'use client'

import { useMemo } from 'react'
import { Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

/**
 * Stage 132.3 / 170.2 — mobile sticky withdraw CTA on /profile/wallet (ADR-100: above bottom nav).
 */
export function ReferralWalletStickyWithdraw({
  visible = false,
  disabled = false,
  loading = false,
  requested = false,
  amountLabel = '',
  onWithdraw,
}) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])

  if (!visible) return null

  const label = requested
    ? t('stage1322_waterfallSubmitRequested')
    : loading
      ? t('stage1322_waterfallSubmitSending')
      : t('stage1323_stickyWithdrawCta')

  return (
    <div
      className="md:hidden fixed inset-x-0 app-fixed-above-bottom-nav z-50 border-t border-slate-200/90 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/90 px-3 pt-2 pb-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]"
      aria-label={t('stage1323_stickyWithdrawAria')}
    >
      <div className="mx-auto max-w-lg flex items-center gap-2 min-w-0">
        {amountLabel ? (
          <p className="text-[11px] leading-tight text-slate-500 min-w-0 flex-1 truncate">
            {t('stage1323_stickyWithdrawHint', { amount: amountLabel })}
          </p>
        ) : (
          <span className="flex-1" />
        )}
        <Button
          type="button"
          variant="brand"
          size="sm"
          className="shrink-0 min-h-10 px-4 text-sm font-semibold"
          disabled={disabled || loading || requested}
          onClick={() => onWithdraw?.()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-1.5" aria-hidden />
          ) : (
            <Wallet className="h-4 w-4 mr-1.5" aria-hidden />
          )}
          {label}
        </Button>
      </div>
    </div>
  )
}

export default ReferralWalletStickyWithdraw
