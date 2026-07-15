'use client'

import { useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import {
  ArrowLeft,
  Copy,
  Gift,
  Share2,
  Sparkles,
  TrendingUp,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { cn } from '@/lib/utils'
import { persistPendingReferralFromLanding } from '@/lib/referral/persist-pending-ref-client'
import { ReferralEarningsEstimator } from '@/components/referral/ReferralEarningsEstimator'
import { ReferralTeamMetricsStrip } from '@/components/referral/ReferralTeamMetricsStrip'
import { ReferralAmbassadorLevels } from '@/components/referral/ReferralAmbassadorLevels'
import { ReferralBadgesGrid } from '@/components/referral/ReferralBadgesGrid'
import { ReferralBonusSavedBanner } from '@/components/referral/ReferralBonusSavedBanner'
import { useReferralModalFollowup } from '@/hooks/useReferralModalFollowup'
import { resolveAvatarDisplaySrc } from '@/lib/image-display-url'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { toast } from 'sonner'

/**
 * Stage 114.3 — публичная визитка амбассадора `/u/[id]`.
 * @param {{ landing: object, profile?: object | null, visitorCountry?: string, landingEarningPreview?: object | null }} props
 */
export function AmbassadorPublicLanding({
  landing,
  profile = null,
  visitorCountry = '',
  landingEarningPreview = null,
}) {
  const router = useRouter()
  const { language } = useI18n()
  const { user: currentUser } = useAuth()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const { formatThbAsDisplay } = useReferralLedgerDisplay()
  const { showFollowupBanner, promptRegisterForReferral } = useReferralModalFollowup()

  const locale =
    language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'
  const code = String(landing?.referralCode || '').trim()
  const joinUrl = String(landing?.joinUrl || landing?.landingUrl || '').trim()
  const displayName = String(landing?.displayName || profile?.displayName || 'Ambassador').trim()
  const initial = displayName.charAt(0).toUpperCase()

  useEffect(() => {
    if (code) persistPendingReferralFromLanding(code)
  }, [code])

  /** Клик по «Присоединиться»: залогиненный — в каталог по ссылке; гость — модалка регистрации. */
  function handleJoinClick() {
    if (currentUser?.id) {
      router.push(joinUrl || '/')
      return
    }
    promptRegisterForReferral()
  }

  async function copyJoinLink() {
    if (!joinUrl) return
    try {
      await navigator.clipboard.writeText(joinUrl)
      toast.success(t('referralStage726_linkCopied'))
    } catch {
      toast.error(t('referralStage726_copyFail'))
    }
  }

  async function shareNative() {
    if (!joinUrl || typeof navigator === 'undefined' || !navigator.share) {
      void copyJoinLink()
      return
    }
    try {
      await navigator.share({
        title: t('stage1143_publicShareTitle').replace('{name}', displayName),
        text: t('stage1143_publicShareText').replace('{name}', displayName),
        url: joinUrl,
      })
    } catch {
      /* cancelled */
    }
  }

  const geoHintLine =
    visitorCountry &&
    landingEarningPreview?.visitorCurrencyCode &&
    landingEarningPreview.formattedConverted
      ? t('stage76_landingEarningTeaser')
          .replace('{converted}', String(landingEarningPreview.formattedConverted))
          .replace('{currency}', String(landingEarningPreview.visitorCurrencyCode))
          .replace('{geo}', visitorCountry.trim().slice(0, 2).toUpperCase())
      : null

  const isSelf =
    !!currentUser?.id &&
    !!landing?.userId &&
    String(currentUser.id).toLowerCase() === String(landing.userId).toLowerCase()

  return (
    <div className={cn('min-h-screen bg-brand-surface text-slate-900 sm:pb-16', !isSelf && 'app-shell-secondary-chrome-pad')}>
      <div className="border-b border-slate-200/80 bg-white/90 backdrop-blur-md sticky app-sticky-below-header z-10">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/listings" aria-label={t('publicProfileBack')}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500 uppercase tracking-wide">{landing?.siteDisplayName}</p>
            <h1 className="text-lg font-bold truncate">{displayName}</h1>
          </div>
          {landing?.badgeLabel ? (
            <Badge className="shrink-0 border-amber-300 bg-amber-50 text-amber-950">{landing.badgeLabel}</Badge>
          ) : null}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-3 sm:px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <section className="relative overflow-hidden rounded-2xl border border-brand/20 bg-gradient-to-br from-brand via-brand-hover to-teal-900 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_45%)]" />
          <div className="relative p-6 sm:p-8 flex flex-col lg:flex-row gap-8 items-center">
            <Avatar className="h-28 w-28 border-4 border-white/20 shadow-xl shrink-0">
              {landing?.avatarUrl || profile?.avatar ? (
                <AvatarImage
                  src={resolveAvatarDisplaySrc(landing?.avatarUrl || profile?.avatar) || ''}
                  alt=""
                  className="object-cover"
                />
              ) : null}
              <AvatarFallback className="bg-white/20 text-4xl font-bold">{initial}</AvatarFallback>
            </Avatar>
            <div className="flex-1 text-center lg:text-left space-y-4 min-w-0">
              <div>
                <p className="text-white/80 text-sm font-medium flex items-center justify-center lg:justify-start gap-2">
                  <Gift className="h-4 w-4" />
                  {t('stage1143_publicHeroKicker')}
                </p>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight mt-1 break-words">{displayName}</h2>
                <p className="text-white/85 mt-2 text-sm sm:text-base max-w-xl">{t('stage1143_publicHeroSubtitle')}</p>
              </div>
              <TooltipProvider delayDuration={200}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    {
                      key: 'total',
                      label: t('stage1143_statEarnedTotal'),
                      value: formatThbAsDisplay(landing?.totalEarnedThb),
                      tip: t('stage1147_statEarnedTooltip'),
                      className: '',
                    },
                    {
                      key: 'month',
                      label: t('stage1143_statEarnedMonth'),
                      value: formatThbAsDisplay(landing?.monthlyEarnedThb),
                      tip: t('stage1147_statMonthTooltip'),
                      className: '',
                    },
                  ].map((stat) => (
                    <Tooltip key={stat.key}>
                      <TooltipTrigger asChild>
                        <div
                          className={`rounded-xl bg-white/10 backdrop-blur px-3 py-2.5 border border-white/15 cursor-help ${stat.className}`}
                        >
                          <p className="text-[10px] uppercase tracking-wide text-white/75">{stat.label}</p>
                          <p className="text-xl font-bold tabular-nums">{stat.value}</p>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="max-w-xs text-xs">
                        {stat.tip}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
              <ReferralTeamMetricsStrip
                friendsInvited={landing?.friendsInvited}
                directPartnersInvited={landing?.directPartnersInvited}
                variant="dark"
                t={t}
                className="max-w-md mx-auto lg:mx-0"
              />
              {geoHintLine ? (
                <p className="text-sm text-white/90 bg-white/10 rounded-lg px-3 py-2 border border-white/10">{geoHintLine}</p>
              ) : null}
            </div>
            <div className="shrink-0 rounded-2xl bg-white p-4 shadow-xl">
              {joinUrl ? (
                <QRCodeSVG value={joinUrl} size={160} level="M" includeMargin className="mx-auto" />
              ) : (
                <div className="h-[160px] w-[160px] bg-slate-100 rounded" />
              )}
              <p className="text-center text-xs text-slate-500 mt-2 font-mono">{code || '—'}</p>
            </div>
          </div>
        </section>

        {!isSelf ? (
          <Card className="rounded-2xl border-2 border-brand/25 shadow-md hidden sm:block">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-brand">
                <UserPlus className="h-5 w-5" />
                {t('stage1143_joinCtaTitle')}
              </CardTitle>
              <CardDescription>{t('stage1143_joinCtaSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row flex-wrap gap-2">
              <Button
                variant="brand"
                className="flex-1 sm:flex-none min-h-11"
                onClick={handleJoinClick}
              >
                {t('stage1143_joinCtaButton')}
              </Button>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => void copyJoinLink()}>
                <Copy className="h-4 w-4 mr-2" />
                {t('stage1143_copyLink')}
              </Button>
              {typeof navigator !== 'undefined' && navigator.share ? (
                <Button type="button" variant="outline" className="min-h-11" onClick={() => void shareNative()}>
                  <Share2 className="h-4 w-4 mr-2" />
                  {t('stage91_shareNative')}
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-xl border border-brand/25 bg-brand/10">
            <CardContent className="py-4 text-sm text-brand">{t('stage1143_publicSelfHint')}</CardContent>
          </Card>
        )}

        <ReferralBonusSavedBanner
          language={language}
          visible={showFollowupBanner}
          ambassadorUserId={landing?.userId}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand" />
                {t('stage1143_publicLevelsCardTitle')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReferralAmbassadorLevels
                levels={landing?.ambassador?.levels}
                directPartnersInvited={landing?.directPartnersInvited}
                t={t}
              />
            </CardContent>
          </Card>
          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                {t('stage1143_badgesTitle')}
              </CardTitle>
              <CardDescription>{t('stage1143_badgesSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              <ReferralBadgesGrid badgesEarned={landing?.publicGamification?.badgesEarned} t={t} compact />
            </CardContent>
          </Card>
        </div>

        <ReferralEarningsEstimator referralEstimator={landing?.referralEstimator} t={t} locale={locale} />

        <div className="flex flex-wrap gap-2 justify-center">
          <Button variant="outline" asChild>
            <Link href="/about/loyalty">{t('stage91_loyaltyHomeCta')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/listings">{t('stage74_4_listingsCta')}</Link>
          </Button>
        </div>
      </div>

      {!isSelf ? (
        <div className="fixed inset-x-0 app-fixed-above-bottom-nav z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md p-3 app-padb-safe-screen-bottom sm:hidden">
          <div className="mx-auto max-w-4xl flex gap-2">
            <Button
              variant="brand"
              className="flex-1 min-h-11"
              onClick={handleJoinClick}
            >
              {t('stage1143_joinCtaButton')}
            </Button>
            <Button type="button" variant="outline" className="shrink-0 min-h-11 px-3" onClick={() => void copyJoinLink()}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
