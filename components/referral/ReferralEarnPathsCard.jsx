'use client'

import { Users, Home, Share2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'
import { FINTECH_JS_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'
import { cn } from '@/lib/utils'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * Stage 202.39 / 202.40 — two-lane earn map (guest bookings + host/partner activation, one link).
 *
 * @param {{
 *   t: (key: string, ctx?: object) => string,
 *   onShare?: () => void,
 *   onGoToLink?: () => void,
 *   shareBusy?: boolean,
 *   partnerActivationBonusThb?: number | null,
 *   className?: string,
 * }} props
 */
export function ReferralEarnPathsCard({
  t,
  onShare,
  onGoToLink,
  shareBusy = false,
  partnerActivationBonusThb = null,
  className,
}) {
  const activationThb = round2(
    Number(
      partnerActivationBonusThb ?? FINTECH_JS_DEFAULTS.partnerActivationBonusThb,
    ),
  )

  const handleGuestCta = () => {
    if (onShare) onShare()
    else if (onGoToLink) onGoToLink()
  }

  const handlePartnerCta = () => {
    if (onGoToLink) onGoToLink()
    else if (onShare) onShare()
  }

  const partnerBody = (() => {
    const parts = String(t('referralEarnPaths_partnerBody')).split(/(__ACTIVATION__)/)
    return parts.map((part, idx) => {
      if (part === '__ACTIVATION__') {
        return <ReferralLedgerAmount key={`act-${idx}`} thb={activationThb} />
      }
      return <span key={`txt-${idx}`}>{part}</span>
    })
  })()

  return (
    <Card className={cn('gsl-card', className)} data-testid="referral-earn-paths-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('referralEarnPaths_title')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <article
            className="rounded-2xl border border-teal-200/80 bg-teal-50/40 p-4 space-y-2"
            data-testid="referral-earn-path-guest"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-xl bg-teal-600 text-white">
                <Users className="h-4 w-4" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{t('referralEarnPaths_guestTitle')}</h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-700">{t('referralEarnPaths_guestBody')}</p>
            <p className="text-[11px] leading-relaxed text-slate-500">{t('referralEarnPaths_guestWhen')}</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full"
              disabled={shareBusy}
              onClick={() => handleGuestCta()}
            >
              <Share2 className="mr-2 h-4 w-4 shrink-0" aria-hidden />
              {t('referralEarnPaths_guestCta')}
            </Button>
          </article>

          <article
            className="rounded-2xl border border-brand/20 bg-brand/5 p-4 space-y-2"
            data-testid="referral-earn-path-partner"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-xl bg-brand text-white">
                <Home className="h-4 w-4" aria-hidden />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">{t('referralEarnPaths_partnerTitle')}</h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-700">{partnerBody}</p>
            <p className="text-[11px] leading-relaxed text-slate-500">{t('referralEarnPaths_partnerWhen')}</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-[44px] w-full"
              onClick={() => handlePartnerCta()}
            >
              {t('referralEarnPaths_partnerCta')}
            </Button>
          </article>
        </div>

        <p className="text-center text-xs leading-relaxed text-slate-600" data-testid="referral-earn-paths-one-link">
          {t('referralEarnPaths_oneLink')}
        </p>
      </CardContent>
    </Card>
  )
}

export default ReferralEarnPathsCard
