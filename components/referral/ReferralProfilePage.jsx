'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { toast } from 'sonner'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'
import { useReferralMeQuery } from '@/lib/hooks/use-referral-me'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ReferralActivityFeed } from '@/components/referral/ReferralActivityFeed'
import { ReferralPageSkeleton } from '@/components/referral/ReferralPageSkeleton'
import { ReferralProfileTabLink } from '@/components/referral/ReferralProfileTabLink'
import { ReferralProfileTabEarnings } from '@/components/referral/ReferralProfileTabEarnings'
import { ReferralProfileTabTeam } from '@/components/referral/ReferralProfileTabTeam'
import { ReferralProfileTabHistory } from '@/components/referral/ReferralProfileTabHistory'
import { ReferralProfileTabSettings } from '@/components/referral/ReferralProfileTabSettings'
import { MlmConsentModal } from '@/components/referral/MlmConsentModal'
import { ProfileHubNav } from '@/components/product/ProfileHubNav'
import { ProductPageShell } from '@/components/product/ProductPageShell'
import { localizeReferralTierName } from '@/lib/referral/localize-referral-tier-name'
import { Share2, Trophy } from 'lucide-react'

const TAB_ACTIVE =
  'rounded-lg shrink-0 snap-start scroll-mx-3 data-[state=active]:bg-brand data-[state=active]:text-white'

/** justify-start beats TabsList default justify-center (otherwise overflow clips both ends). */
const TABS_LIST_CLASS =
  'flex w-full min-w-0 justify-start overflow-x-auto sm:flex-wrap h-auto gap-1.5 gsl-card p-1.5 shadow-sm scrollbar-thin snap-x snap-proximity scroll-pl-2 scroll-pr-2 [-webkit-overflow-scrolling:touch]'

function formatUnlockDate(iso, locale) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Stage 114.3 / 115.0 — `/profile/referral` с табами (useReferralMeQuery SSOT).
 */
export function ReferralProfilePage() {
  const router = useRouter()
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const locale = language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'
  const { isAuthenticated, loading: authLoading } = useAuth()
  const { data: walletData, isLoading: walletLoading } = useWalletMeQuery({
    enabled: !authLoading && isAuthenticated,
  })
  const { data, isLoading: referralLoading, isError: referralError } = useReferralMeQuery({
    enabled: !authLoading && isAuthenticated,
    includeTeam: true,
    includeTeamAnalytics: true,
    analyticsPeriod: 'month',
    teamLimit: 100,
  })
  const tabsListRef = useRef(null)
  const [tabValue, setTabValue] = useState('earnings')
  const [consentAt, setConsentAt] = useState(undefined)
  const [consentModalOpen, setConsentModalOpen] = useState(false)

  const { formatThbAsDisplay, convertDisplayToThb, currency: displayCurrency } = useReferralLedgerDisplay()

  // Hero inline calculator state (must be declared before early returns).
  const [calcOpen, setCalcOpen] = useState(true)
  const [l1BookingsArr, setL1BookingsArr] = useState([3])
  const [avgBookingArr, setAvgBookingArr] = useState([35000])
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState(null)
  const [calcResult, setCalcResult] = useState(null)

  const runCalculator = useCallback(async () => {
    const l1BookingsCount = Number(l1BookingsArr?.[0] ?? 3)
    const avgBookingDisplay = Number(avgBookingArr?.[0] ?? 35000)
    if (!Number.isFinite(l1BookingsCount) || !Number.isFinite(avgBookingDisplay)) return

    const subtotalThb = Math.max(500, Math.round(convertDisplayToThb(avgBookingDisplay) || 35000))
    const guestFeePercent = 15
    const guestPaymentMode = displayCurrency === 'RUB' ? 'RUB_CROSS' : 'THB'

    const qs = new URLSearchParams({
      subtotalThb: String(subtotalThb),
      guestFeePercent: String(guestFeePercent),
      guestPaymentMode,
      l1BookingsCount: String(l1BookingsCount),
      l2ConversionRate: '0.33',
    })

    setCalcLoading(true)
    setCalcError(null)
    try {
      const res = await fetch(`/api/v2/referral/calculator?${qs.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json.success !== true) {
        setCalcError(json.message || json.error || 'CALCULATOR_FAILED')
        setCalcResult(null)
        return
      }
      setCalcResult(json.data)
    } catch (e) {
      setCalcError(e?.message || 'Network error')
      setCalcResult(null)
    } finally {
      setCalcLoading(false)
    }
  }, [avgBookingArr, l1BookingsArr, convertDisplayToThb, displayCurrency])

  useEffect(() => {
    if (!calcOpen) return
    if (authLoading || referralLoading) return
    const id = setTimeout(() => {
      void runCalculator()
    }, 350)
    return () => clearTimeout(id)
  }, [calcOpen, l1BookingsArr, avgBookingArr, runCalculator, authLoading, referralLoading])

  // Derived state for adaptive hero.
  const earnedThb = round2(Number(data?.stats?.earnedThb ?? 0))
  const withdrawableThb = round2(Number(walletData?.wallet?.withdrawable_balance_thb ?? 0))
  const heldReferralBalanceThb = round2(
    Number(
      walletData?.balances?.heldReferralBalanceThb ??
        data?.stats?.heldReferralBalanceThb ??
        walletData?.wallet?.held_referral_balance_thb ??
        0,
    ),
  )
  const nearestUnlockAt = data?.stats?.nearestUnlockAt || null
  const unlockLabel = formatUnlockDate(nearestUnlockAt, locale)

  const directPartnersInvited = Number(data?.stats?.directPartnersInvited ?? data?.ambassador?.directPartnersInvited ?? 0)
  const ambassador = data?.ambassador || {}
  const currentTier = ambassador.currentTier || null
  const nextTier = ambassador.nextTier || null
  const currentTierName = currentTier?.name ? localizeReferralTierName(currentTier.name, t) : null
  const nextTierName = nextTier?.name ? localizeReferralTierName(nextTier.name, t) : null
  const remainingToNext = nextTier ? Math.max(0, Number(nextTier.minPartnersInvited || 0) - directPartnersInvited) : null
  // `payoutRatio` is stored as a percent already (60 / 75 / 85),
  // so we must NOT multiply by 100 again.
  const nextRewardPct = nextTier ? Math.max(0, Math.round(Number(nextTier.payoutRatio || 0))) : 0

  const diamondTier = Array.isArray(ambassador.tiers)
    ? ambassador.tiers.find((x) => String(x?.name || '').toLowerCase() === 'diamond') || null
    : null
  const remainingToDiamond = diamondTier ? Math.max(0, Number(diamondTier.minPartnersInvited || 0) - directPartnersInvited) : null

  const leaderboardRankMonthly = data?.referralGamification?.leaderboardRankMonthly ?? null
  const isVeteran = earnedThb >= 5000
  const isNew = earnedThb <= 0 && directPartnersInvited <= 0
  const isEarly = earnedThb <= 0 && directPartnersInvited > 0 && directPartnersInvited <= 3
  const adaptiveState = isVeteran ? 'veteran' : isNew ? 'new' : isEarly ? 'early' : 'active'

  const heroDisplayName = String(data?.marketingCard?.displayName || data?.displayName || '').trim() || 'Ambassador'
  const heroCode = String(data?.code || '').trim()

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) router.replace('/profile?login=true')
  }, [authLoading, isAuthenticated, router])

  /**
   * Horizontal-only tab chip centering. Do not use Element.scrollIntoView here —
   * on mobile (Samsung/iOS) it also scrolls the window and hides the page header.
   * Stage 201.35
   */
  useEffect(() => {
    if (referralLoading) return
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0)
    }
    const el = tabsListRef.current
    if (!el) return
    const active = el.querySelector('[data-state="active"]')
    if (!active) {
      el.scrollLeft = 0
      return
    }
    const nextLeft = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2
    el.scrollLeft = Math.max(0, Math.round(nextLeft))
  }, [referralLoading, tabValue])

  useEffect(() => {
    if (referralError) toast.error(t('referralStage726_loadErr'))
  }, [referralError, t])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/referral/consent', { credentials: 'include', cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok || json.success === false) {
          setConsentAt(null)
          setConsentModalOpen(true)
          return
        }
        const at = json.consentAt || null
        setConsentAt(at)
        setConsentModalOpen(!at)
      } catch {
        if (!cancelled) {
          setConsentAt(null)
          setConsentModalOpen(true)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authLoading, isAuthenticated])

  const [userRankData, setUserRankData] = useState(null)
  useEffect(() => {
    if (authLoading || !isAuthenticated) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/referral/me/rank', { credentials: 'include', cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!cancelled && res.ok) setUserRankData(json)
      } catch { /* optional */ }
    })()
    return () => { cancelled = true }
  }, [authLoading, isAuthenticated])

  if (authLoading || referralLoading || walletLoading) {
    return <ReferralPageSkeleton />
  }

  const welcomeBonusThbRaw = Math.round(Number(walletData?.policy?.welcomeBonusAmount ?? 0))
  const welcomeBonusThb = Number.isFinite(welcomeBonusThbRaw) && welcomeBonusThbRaw > 0 ? welcomeBonusThbRaw : 500

  return (
    <ProductPageShell>
      <ProfileHubNav t={t} />

      <div className="space-y-5">
        <div className="relative z-10 -mx-4 px-4 pt-3 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-slate-900 break-words">
                {t('stage131a5_heroWelcomeTitle', { name: heroDisplayName })}
              </h1>
              {heroCode ? (
                <p className="mt-1 text-sm text-slate-600">
                  {t('stage131a5_heroCodeLabel')}: <span className="font-semibold tracking-wide">{heroCode}</span>
                </p>
              ) : null}
            </div>
            <span className="inline-flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-2xl border border-brand/20 bg-brand/10 text-brand-hover font-bold">
              A
            </span>
          </div>

          <div className="mt-4 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs text-slate-500">{t('stage131a5_heroEarnedTotalLabel')}</p>
              <p className="text-3xl font-black text-brand mt-1 tabular-nums break-words">
                {formatThbAsDisplay(earnedThb)}
              </p>
              <p className="mt-1 text-xs text-slate-600">{t('stage131a5_heroWithdrawableSubLabel', { amount: formatThbAsDisplay(withdrawableThb) })}</p>
            </div>

            <Button
              type="button"
              variant="brand"
              className="min-h-[44px] whitespace-nowrap px-3"
              onClick={() => setTabValue('link')}
              disabled={referralLoading}
            >
              <Share2 className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline ml-2">{t('stage131a5_heroShareCta')}</span>
              <span className="hidden sm:inline ml-1">{' \u2192'}</span>
            </Button>
          </div>

          {userRankData?.rank != null && Number(userRankData.total_ambassadors) >= 5 ? (
            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-2 text-sm text-amber-950" data-testid="user-rank-badge">
              <Trophy className="h-4 w-4 text-amber-600 shrink-0" aria-hidden />
              <span>
                {t('stage131a61_rankLine', {
                  rank: String(userRankData.rank),
                  total: String(userRankData.total_ambassadors),
                })}
              </span>
              {userRankData.next_rank_bucket_hint ? (
                <span className="ml-auto text-xs text-amber-700/80 shrink-0">{userRankData.next_rank_bucket_hint}</span>
              ) : null}
            </div>
          ) : null}

          <p className="mt-3 text-sm text-slate-700 rounded-2xl border border-brand/10 bg-brand/5 px-4 py-2" role="status">
            {adaptiveState === 'new'
              ? t('stage131a5_adaptive_new', {
                  remaining: remainingToNext ?? 5,
                  nextTier: nextTierName ?? t('stage73_tierFallbackPro'),
                  rewardPct: nextRewardPct || 5,
                })
              : adaptiveState === 'early'
                ? t('stage131a5_adaptive_early', {
                    remaining: remainingToNext ?? 5,
                    nextTier: nextTierName ?? t('stage73_tierFallbackPro'),
                  })
                : adaptiveState === 'active'
                  ? t('stage131a5_adaptive_active', {
                      earned: formatThbAsDisplay(earnedThb),
                      nextTier: nextTierName ?? 'Gold',
                      remaining: remainingToNext ?? 10,
                    })
                  : t('stage131a5_adaptive_veteran', {
                      earned: formatThbAsDisplay(earnedThb),
                      remainingDiamond: remainingToDiamond ?? 0,
                      rankMonthly: leaderboardRankMonthly != null ? `#${leaderboardRankMonthly}` : '',
                    })}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="gsl-card">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{t('stage131a5_calcTitle')}</p>
                  <p className="text-xs text-slate-500 mt-1">{t('stage131a5_calcSubtitle')}</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setCalcOpen((v) => !v)} className="min-h-[44px]">
                  {calcOpen ? t('stage131a5_calcCollapse') : t('stage131a5_calcExpand')}
                </Button>
              </div>

              {calcOpen ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-800">{t('stage131a5_calcFriendsLabel')}</p>
                      <p className="text-sm font-semibold tabular-nums text-slate-900">{l1BookingsArr?.[0] ?? 3}</p>
                    </div>
                    <Slider
                      min={1}
                      max={100}
                      step={1}
                      value={l1BookingsArr}
                      onValueChange={setL1BookingsArr}
                      className="py-1"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-slate-800">{t('stage131a5_calcAvgBookingLabel', { currency: displayCurrency })}</p>
                      <p className="text-sm font-semibold tabular-nums text-slate-900">{avgBookingArr?.[0] ?? 35000}</p>
                    </div>
                    <Slider
                      min={1000}
                      max={500000}
                      step={1000}
                      value={avgBookingArr}
                      onValueChange={setAvgBookingArr}
                      className="py-1"
                    />
                  </div>

                  {calcLoading ? (
                    <p className="text-sm text-slate-600">{t('stage131a5_calcLoading')}</p>
                  ) : calcError ? (
                    <p className="text-sm text-rose-600">{calcError}</p>
                  ) : calcResult ? (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">{t('stage131a5_calcLineL1', { pct: calcResult?.splitPercents?.l1 ?? 42 })}</p>
                      <p className="text-lg font-semibold text-slate-900 tabular-nums">
                        {formatThbAsDisplay(Number(calcResult?.l1TotalThb || 0))}
                      </p>

                      <p className="text-xs text-slate-500 mt-2">{t('stage131a5_calcLineL2', { pct: calcResult?.splitPercents?.l2 ?? 10 })}</p>
                      <p className="text-lg font-semibold text-slate-900 tabular-nums">
                        {formatThbAsDisplay(Number(calcResult?.l2TotalThb || 0))}
                      </p>

                      {Number(calcResult?.l3TotalThb || 0) > 0 ? (
                        <>
                          <p className="text-xs text-slate-500 mt-2">{t('stage131a5_calcLineL3', { pct: calcResult?.splitPercents?.l3 ?? 5 })}</p>
                          <p className="text-lg font-semibold text-slate-900 tabular-nums">
                            {formatThbAsDisplay(Number(calcResult?.l3TotalThb || 0))}
                          </p>
                        </>
                      ) : null}

                      <div className="pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-500">{t('stage131a5_calcTotalLabel')}</p>
                        <p className="text-2xl font-black text-brand tabular-nums">
                          {formatThbAsDisplay(
                            round2(
                              Number(calcResult?.l1TotalThb || 0) +
                                Number(calcResult?.l2TotalThb || 0) +
                                Number(calcResult?.l3TotalThb || 0),
                            ),
                          )}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 mt-2">
                        <p className="text-sm text-slate-700">{t('stage131a5_calcGuestCashbackLabel')}</p>
                        <p className="text-sm font-semibold tabular-nums text-slate-900">
                          {formatThbAsDisplay(Number(calcResult?.guestCashbackTotalThb || 0))}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="link"
                        className="w-full justify-start p-0 h-auto min-h-0"
                        onClick={() => router.push('/about/referral')}
                      >
                        {t('stage131a5_calcDetailsLink')}
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card className="gsl-card">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-200/90 bg-emerald-50/50 p-3">
                    <p className="text-xs text-slate-600">{t('stage131a5_balanceAvailable')}</p>
                    <p className="mt-2 text-xl font-black text-emerald-950 tabular-nums">{formatThbAsDisplay(withdrawableThb)}</p>
                    <p className="mt-1 text-[11px] text-slate-600">{t('stage131a5_balanceAvailableHint')}</p>
                  </div>
                  <div className="rounded-xl border border-amber-200/90 bg-amber-50/60 p-3">
                    <p className="text-xs text-slate-600">{t('stage131a5_balanceHeld')}</p>
                    <p className="mt-2 text-xl font-black text-amber-950 tabular-nums">{formatThbAsDisplay(heldReferralBalanceThb)}</p>
                    <p className="mt-1 text-[11px] text-slate-600">
                      {unlockLabel ? t('stage131a5_balanceUnlockAtHint', { date: unlockLabel }) : t('stage131a5_balanceHeldHint')}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <p className="text-xs text-slate-600">{t('stage131a5_balanceEarnedLifetime')}</p>
                    <p className="mt-2 text-xl font-black text-slate-900 tabular-nums">{formatThbAsDisplay(earnedThb)}</p>
                    <p className="mt-1 text-[11px] text-slate-600">{t('stage131a5_balanceEarnedLifetimeHint')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="gsl-card">
              <CardContent className="p-4 space-y-3">
                <p className="text-sm font-semibold text-slate-900">{t('stage131a5_progressTitle')}</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-800">
                      {t('stage131a5_progressCurrent', { tier: currentTierName || '—' })}
                    </p>
                    {nextTierName ? (
                      <p className="text-sm font-semibold text-slate-900">{t('stage131a5_progressNextReward', { pct: nextRewardPct })}</p>
                    ) : null}
                  </div>
                  {typeof ambassador?.tierProgressPercent === 'number' ? (
                    <Progress value={Number(ambassador.tierProgressPercent || 0)} className="h-2" />
                  ) : null}

                  {nextTierName && remainingToNext != null ? (
                    <p className="text-sm text-slate-600">{t('stage131a5_progressRemaining', { tier: nextTierName, count: remainingToNext })}</p>
                  ) : (
                    <p className="text-sm text-slate-600">{t('stage131a5_progressMax')}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <ReferralActivityFeed pageLimit={5} hideLoadMore layout="carousel" />
              <Button variant="outline" className="w-full min-h-[44px]" onClick={() => setTabValue('history')}>
                {t('stage131a5_historyAll')}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500" data-testid="referral-mlm-persistent-disclaimer">
        {t('referral_mlm_persistent_disclaimer')}
      </p>

      <MlmConsentModal
        open={consentAt === null && consentModalOpen}
        language={language}
        t={t}
        onOpenChange={(next, meta) => {
          setConsentModalOpen(next)
          if (meta?.consented) setConsentAt(meta.consentAt || new Date().toISOString())
        }}
      />

      <Tabs value={tabValue} onValueChange={setTabValue} className="space-y-6 mt-6">
        <TabsList ref={tabsListRef} className={TABS_LIST_CLASS} data-testid="referral-profile-tabs">
          <TabsTrigger value="earnings" className={TAB_ACTIVE}>
            {t('stage1143_tabEarnings')}
          </TabsTrigger>
          <TabsTrigger value="team" className={TAB_ACTIVE}>
            {t('stage1143_tabTeam')}
          </TabsTrigger>
          <TabsTrigger value="link" className={TAB_ACTIVE}>
            {t('stage1143_tabLink')}
          </TabsTrigger>
          <TabsTrigger value="history" className={TAB_ACTIVE}>
            {t('stage1143_tabHistory')}
          </TabsTrigger>
          <TabsTrigger value="settings" className={TAB_ACTIVE}>
            {t('stage1143_tabSettings')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="link">
          <ReferralProfileTabLink data={data} walletData={walletData} t={t} locale={locale} welcomeBonusThb={welcomeBonusThb} />
        </TabsContent>
        <TabsContent value="earnings">
          <ReferralProfileTabEarnings data={data} walletData={walletData} t={t} locale={locale} />
        </TabsContent>
        <TabsContent value="team">
          <ReferralProfileTabTeam data={data} t={t} locale={locale} language={language} />
        </TabsContent>
        <TabsContent value="history">
          <ReferralProfileTabHistory data={data} walletData={walletData} t={t} locale={locale} />
        </TabsContent>
        <TabsContent value="settings">
          <ReferralProfileTabSettings data={data} t={t} />
        </TabsContent>
      </Tabs>
    </ProductPageShell>
  )
}

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}
