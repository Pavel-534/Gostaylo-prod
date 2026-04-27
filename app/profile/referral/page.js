'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Gift, Copy, Loader2, Users, Wallet, Share2, MessageCircle } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { toast } from 'sonner'
import { UnifiedBalanceSummary } from '@/components/wallet/UnifiedBalanceSummary'
import { ReferralTeamSection } from '@/components/referral/ReferralTeamSection'
import { ReferralActivityFeed } from '@/components/referral/ReferralActivityFeed'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

export default function ReferralProfilePage() {
  const router = useRouter()
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const locale = language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'

  const { isAuthenticated, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const { data: walletData } = useWalletMeQuery({
    enabled: !authLoading && isAuthenticated,
  })

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/profile?login=true')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const refRes = await fetch('/api/v2/referral/me', { credentials: 'include', cache: 'no-store' })
        const json = await refRes.json().catch(() => ({}))
        if (!cancelled) {
          if (refRes.ok && json?.success) {
            setData(json.data || null)
          } else {
            toast.error(json?.error || t('referralStage726_loadErr'))
          }
        }
      } catch {
        if (!cancelled) toast.error(t('referralStage726_pageErr'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated, router, t])

  const welcomeExpiryHint = (() => {
    const w = walletData?.wallet
    const rem = Number(w?.welcome_bonus_remaining_thb ?? 0)
    const expIso = w?.welcome_bonus_expires_at
    if (!(rem > 0) || !expIso) return null
    const exp = new Date(expIso)
    const now = new Date()
    if (Number.isNaN(exp.getTime()) || exp <= now) return null
    const days = Math.ceil((exp.getTime() - now.getTime()) / 86400000)
    return { rem, days, expIso }
  })()

  const payoutProgress = (() => {
    const balances = walletData?.balances
    if (!balances) return null
    const withdrawable = Number(
      balances.withdrawableBalanceThb ?? walletData?.wallet?.withdrawable_balance_thb ?? 0,
    )
    const internal = Number(balances.internalCreditsThb ?? walletData?.wallet?.internal_credits_thb ?? 0)
    const total = Math.max(0, withdrawable + internal)
    return {
      withdrawable: Math.max(0, withdrawable),
      internal: Math.max(0, internal),
      total,
      withdrawablePct: total > 0 ? Math.round((Math.max(0, withdrawable) / total) * 100) : 0,
    }
  })()

  async function handleCopyLink() {
    const link = String(data?.referralLink || '').trim()
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success(t('referralStage726_linkCopied'))
    } catch {
      toast.error(t('referralStage726_copyFail'))
    }
  }

  function handleShareTelegram() {
    const text = encodeURIComponent(String(data?.shareMessage || data?.referralLink || ''))
    if (!text) return
    window.open(`https://t.me/share/url?url=&text=${text}`, '_blank', 'noopener,noreferrer')
  }

  function handleShareWhatsApp() {
    const text = encodeURIComponent(String(data?.shareMessage || data?.referralLink || ''))
    if (!text) return
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  function pluralDays(n) {
    if (language === 'en') return n === 1 ? t('referralStage726_day') : t('referralStage726_days5')
    return n === 1 ? t('referralStage726_day') : n >= 2 && n <= 4 ? t('referralStage726_days2') : t('referralStage726_days5')
  }

  const ambassadorSubtitle = useMemo(() => {
    const amb = data?.ambassador
    if (!amb) return ''
    if (amb.remainingToNextTier > 0 && amb.nextTier?.name) {
      return t('referralStage726_ambassadorNext')
        .replace('{count}', Number(amb.remainingToNextTier).toLocaleString(locale))
        .replace('{tier}', String(amb.nextTier.name))
    }
    return t('referralStage726_ambassadorMax')
  }, [data?.ambassador, t, locale])

  if (authLoading || loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card>
          <CardContent className="py-10 flex items-center justify-center text-slate-600">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            {t('referralStage726_load')}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 space-y-4">
      {walletData ? <UnifiedBalanceSummary walletPayload={walletData} t={t} /> : null}

      <ReferralTeamSection members={data?.teamMembers || []} t={t} language={language} />

      <ReferralActivityFeed />

      {data?.inviteNetwork ? (
        <Card className="border border-slate-200 bg-slate-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('referralStage726_inviteNetworkTitle')}</CardTitle>
            <CardDescription className="text-xs">{t('referralStage726_inviteNetworkDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-slate-800 space-y-1">
            <p>
              {t('referralStage726_depthLabel')}:{' '}
              <span className="font-semibold tabular-nums">{Number(data.inviteNetwork.depth || 1)}</span>
            </p>
            <p className="text-xs text-slate-600">
              {t('referralStage726_ancestorLabel')}:{' '}
              <span className="font-mono tabular-nums">{Number(data.inviteNetwork.ancestorChainLength || 0)}</span>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border border-dashed border-slate-200 bg-white">
          <CardContent className="py-4 text-sm text-slate-600">{t('referralStage726_rootHint')}</CardContent>
        </Card>
      )}

      {walletData?.payout ? (
        <Card
          className={
            walletData.payout.payoutEligible
              ? 'border border-emerald-200 bg-emerald-50/70'
              : 'border border-slate-200 bg-white'
          }
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-700" />
              {t('referralStage726_payoutTitle')}
            </CardTitle>
            <CardDescription className="text-xs">
              {t('referralStage726_payoutMin').replace('{amount}', formatThb(walletData.payout.minPayoutThb, locale))}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p className={walletData.payout.payoutEligible ? 'text-emerald-900 font-medium' : 'text-slate-700'}>
              {walletData.payout.payoutEligible
                ? t('referralStage726_payoutReady')
                : `${t('referralStage726_payoutBlocked')}: ${(walletData.payout.blockers || []).join(', ') || '—'}`}
            </p>
            {!walletData.payout.profileVerified ? (
              <p className="text-xs text-amber-800">{t('referralStage726_confirmEmail')}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {payoutProgress ? (
        <Card className="border border-indigo-200 bg-indigo-50/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('referralStage726_bonusSplitTitle')}</CardTitle>
            <CardDescription className="text-xs">{t('referralStage726_bonusSplitMeta')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-slate-700">
              {t('referralStage726_withdrawableLabel')}: {formatThb(payoutProgress.withdrawable, locale)} THB ·{' '}
              {t('referralStage726_internalServicesLabel')}: {formatThb(payoutProgress.internal, locale)} THB
            </p>
            <Progress value={payoutProgress.withdrawablePct} className="h-2" />
            <p className="text-xs text-slate-600">
              {t('referralStage726_pctOut')} {payoutProgress.withdrawablePct}% / {t('referralStage726_pctServices')}{' '}
              {Math.max(0, 100 - payoutProgress.withdrawablePct)}%
            </p>
          </CardContent>
        </Card>
      ) : null}

      {payoutProgress && payoutProgress.internal > 0 ? (
        <Card className="border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('referralStage726_marketingPushTitle')}</CardTitle>
            <CardDescription className="text-xs text-amber-900">{t('referralStage726_spendHint')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push('/renter/bookings')}>
              {t('referralStage726_spendCta')}
            </Button>
            <Button onClick={() => router.push('/partner/listings?upsell=priority')}>
              {t('referralStage726_priorityCta')}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-teal-600" />
            {t('referralStage726_inviteTitle')}
          </CardTitle>
          <CardDescription>{t('referralStage726_inviteDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{t('referralStage726_yourCode')}</p>
            <Input value={data?.code || 'AIR-XXXXXX'} readOnly className="font-semibold tracking-wide" />
          </div>
          <div className="space-y-2">
            <p className="text-xs text-slate-500">{t('referralStage726_yourLink')}</p>
            <div className="flex gap-2">
              <Input value={data?.referralLink || ''} readOnly />
              <Button type="button" onClick={handleCopyLink} className="bg-teal-600 hover:bg-teal-700">
                <Copy className="h-4 w-4 mr-1" />
                {t('referralStage726_copy')}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button type="button" variant="outline" onClick={handleShareTelegram}>
              <MessageCircle className="h-4 w-4 mr-1" />
              {t('referralStage726_shareTg')}
            </Button>
            <Button type="button" variant="outline" onClick={handleShareWhatsApp}>
              <Share2 className="h-4 w-4 mr-1" />
              {t('referralStage726_shareWa')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {data?.turbo?.enabled === true && Number(data?.turbo?.promoBoostPerBookingThb || 0) > 0 ? (
        <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-amber-900">{t('referralStage726_turboTitle')}</CardTitle>
            <CardDescription className="text-amber-800">
              {t('referralStage726_turboDesc')} +{formatThb(data?.turbo?.promoBoostPerBookingThb, locale)} THB
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-slate-700">{t('referralStage726_turboBoostLine')}</p>
            <p className="text-xl font-bold text-amber-700">
              <span className="line-through text-slate-400 mr-2">
                +฿{formatThb(data?.turbo?.oldReferrerBonusWithBoostThb, locale)}
              </span>
              +฿{formatThb(data?.turbo?.newReferrerBonusWithBoostThb, locale)}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('referralStage726_ambassadorTitle')}</CardTitle>
          <CardDescription>{ambassadorSubtitle}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-slate-500">{t('stage73_ambassadorProgressCaption')}</p>
          <Progress value={Number(data?.ambassador?.tierProgressPercent || 0)} className="h-2" />
          {data?.ambassador?.nextTier?.name ? (
            <p className="text-sm text-emerald-900 font-medium leading-snug">
              {t('stage73_ambassadorBenefitNext')
                .replace('{tier}', String(data.ambassador.nextTier.name))
                .replace(
                  '{pct}',
                  String(Math.round(Number(data.ambassador.nextTier.payoutRatio ?? 0) * 100) / 100),
                )}
            </p>
          ) : null}
          <div className="text-sm text-slate-600 flex flex-wrap items-center gap-2">
            <span>
              {t('referralStage726_ambassadorTier')}:{' '}
              <strong>{data?.ambassador?.currentTier?.name || 'Beginner'}</strong>
            </span>
            <span>·</span>
            <span>
              {t('referralStage726_ambassadorPartners')}:{' '}
              {Number(data?.ambassador?.directPartnersInvited || 0).toLocaleString(locale)}
            </span>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-xs underline underline-offset-2 text-indigo-700"
                    aria-label={t('referralStage726_payoutHow')}
                  >
                    {t('referralStage726_payoutHow')}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('referralStage726_payoutTooltipDynamic').replace(
                    '{pct}',
                    String(
                      Math.round(Number(data?.ambassador?.currentTier?.payoutRatio ?? 0) * 100) / 100,
                    ),
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-slate-500">{t('referralStage726_statPending')}</p>
            <p className="text-xl font-semibold text-amber-700 flex items-center gap-2">
              <Wallet className="h-4 w-4" /> ฿{formatThb(data?.stats?.pendingThb, locale)}
            </p>
            {welcomeExpiryHint ? (
              <p className="text-xs rounded-md bg-amber-50 border border-amber-200 text-amber-950 px-2 py-1.5 leading-snug">
                {t('referralStage726_welcomeBurn')
                  .replace('{amount}', formatThb(welcomeExpiryHint.rem, locale))
                  .replace('{days}', String(welcomeExpiryHint.days))
                  .replace('{daysLabel}', pluralDays(welcomeExpiryHint.days))}
              </p>
            ) : walletData?.wallet?.balance_thb != null ? (
              <p className="text-xs text-slate-500">
                {t('referralStage726_walletBreakdown')
                  .replace('{total}', formatThb(walletData.wallet.balance_thb, locale))
                  .replace('{internal}', formatThb(walletData?.wallet?.internal_credits_thb || 0, locale))
                  .replace('{withdrawable}', formatThb(walletData?.wallet?.withdrawable_balance_thb || 0, locale))}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{t('referralStage726_statEarned')}</p>
            <p className="text-xl font-semibold text-emerald-700 flex items-center gap-2">
              <Wallet className="h-4 w-4" /> ฿{formatThb(data?.stats?.earnedThb, locale)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-slate-500">{t('referralStage726_statFriends')}</p>
            <p className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <Users className="h-4 w-4" />
              {Number(data?.stats?.friendsInvited || 0).toLocaleString(locale)}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
