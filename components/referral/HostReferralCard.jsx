'use client'

import { useCallback, useMemo, useState } from 'react'
import { Home, Share2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ReferralLedgerAmount } from '@/components/referral/ReferralLedgerAmount'
import { formatAmbassadorShareLink } from '@/lib/referral/ambassador-utm-link'
import { getSiteDisplayName } from '@/lib/site-url'
import { FINTECH_JS_DEFAULTS } from '@/lib/config/fintech-config-defaults.js'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
} from '@/lib/ui/mobile-flat-canvas'
import { toast } from 'sonner'

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * Stage 202.33 / 202.40 — supply-side host/partner referral card (Link tab).
 * Honest copy: YOU get one-shot activation pot (SSOT THB → display), not "host gets pot at start".
 *
 * @param {{
 *   data: object,
 *   t: (key: string, ctx?: object) => string,
 *   className?: string,
 * }} props
 */
export function HostReferralCard({ data, t, className }) {
  const [shareBusy, setShareBusy] = useState(false)
  const brand = String(data?.brandName || '').trim() || getSiteDisplayName()
  const estimator = data?.referralEstimator || {}

  const activationThb = round2(
    Number(
      estimator.partnerActivationBonusThb ??
        estimator.partner_activation_bonus_thb ??
        FINTECH_JS_DEFAULTS.partnerActivationBonusThb,
    ),
  )

  const cleanInviteLink = useMemo(() => {
    const preferred = String(
      data?.vanityUrl || data?.referralLandingUrl || data?.referralLink || '',
    ).trim()
    return formatAmbassadorShareLink(preferred) || preferred
  }, [data?.vanityUrl, data?.referralLandingUrl, data?.referralLink])

  const renderYouEarnLine = useCallback(() => {
    const parts = String(t('hostReferralCard_subtitle')).split(/(__ACTIVATION__)/)
    return parts.map((part, idx) => {
      if (part === '__ACTIVATION__') {
        return <ReferralLedgerAmount key={`act-${idx}`} thb={activationThb} />
      }
      return <span key={`txt-${idx}`}>{part}</span>
    })
  }, [t, activationThb])

  const handleShare = useCallback(async () => {
    const url = String(cleanInviteLink || '').trim()
    if (!url || shareBusy) return
    setShareBusy(true)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: t('hostReferralCard_title'),
            text: String(t('hostReferralDisclosure') || '').replace(/\{brand\}/g, brand),
            url,
          })
          return
        } catch (err) {
          if (err?.name === 'AbortError') return
        }
      }
      await navigator.clipboard.writeText(url)
      toast.success(t('referralStage726_linkCopied'))
    } catch {
      toast.error(t('referralStage726_copyFail'))
    } finally {
      setShareBusy(false)
    }
  }, [cleanInviteLink, shareBusy, t, brand])

  return (
    <Card className={cn(MOBILE_FLAT_CARD_CLASS, className)} data-testid="host-referral-card">
      <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 min-h-[36px] min-w-[36px] items-center justify-center rounded-xl bg-brand text-white">
            <Home className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle>{t('hostReferralCard_title')}</CardTitle>
            <CardDescription className="text-slate-600">
              {t('hostReferralCard_categories')}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-3')}>
        <p className="text-sm leading-relaxed text-slate-700" data-testid="host-referral-you-earn">
          {renderYouEarnLine()}
        </p>
        <p className="text-xs leading-relaxed text-slate-500" data-testid="host-referral-withdraw-hint">
          {t('hostReferralCard_withdrawHint')}
        </p>
        <p className="text-xs leading-relaxed text-slate-500" data-testid="host-referral-welcome-separate">
          {t('hostReferralCard_welcomeSeparate')}
        </p>
        <p className="text-[11px] leading-relaxed text-slate-400" data-testid="host-referral-example-disclaimer">
          {t('hostReferralCard_exampleDisclaimer')}
        </p>
        <p className="text-[11px] leading-relaxed text-slate-500">{t('hostReferralCard_promoNote')}</p>
        <Button
          type="button"
          variant="brand"
          className="min-h-[44px] w-full"
          data-testid="host-referral-share"
          disabled={!cleanInviteLink || shareBusy}
          onClick={() => void handleShare()}
        >
          <Share2 className="mr-2 h-4 w-4" />
          {t('hostReferralCard_shareCta')}
        </Button>
        <p className="text-[11px] leading-relaxed text-slate-500" data-testid="host-referral-disclosure">
          {t('hostReferralDisclosure')}
        </p>
        <p className="text-[11px] leading-relaxed text-slate-500" data-testid="host-referral-no-agency">
          {t('noAgencyRelationship', { brand })}
        </p>
      </CardContent>
    </Card>
  )
}

export default HostReferralCard
