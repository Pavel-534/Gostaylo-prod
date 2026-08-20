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
import { ReferralCalculatorV2 } from '@/components/referral/ReferralCalculatorV2'
import { ReferralWithdrawEntryCta } from '@/components/referral/ReferralWithdrawEntryCta'
import { ProfileHubNav } from '@/components/product/ProfileHubNav'
import { ProductPageShell } from '@/components/product/ProductPageShell'
import { localizeReferralTierName } from '@/lib/referral/localize-referral-tier-name'
import { formatAmbassadorShareLink } from '@/lib/referral/ambassador-utm-link'
import { getSiteDisplayName } from '@/lib/site-url'
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
  const skipTabScrollTopOnceRef = useRef(false)
  const [tabValue, setTabValue] = useState('overview')
  const [consentAt, setConsentAt] = useState(undefined)
  const [consentModalOpen, setConsentModalOpen] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)

  const { formatThbAsDisplay } = useReferralLedgerDisplay()

  // Derived state for adaptive hero.
  const earnedThb = round2(Number(data?.stats?.earnedThb ?? 0))
  const withdrawableThb = round2(Number(walletData?.wallet?.withdrawable_balance_thb ?? 0))
  const starterPreviewAmount = formatThbAsDisplay(2500)
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
  const currentRewardPct = Math.max(
    0,
    Math.round(Number(ambassador?.currentTier?.payoutRatio ?? currentTier?.payoutRatio ?? 60)),
  )
  const nextRewardPct = nextTier ? Math.max(0, Math.round(Number(nextTier.payoutRatio || 0))) : 0
  const tierLadder = Array.isArray(ambassador?.tiers)
    ? ambassador.tiers
    : Array.isArray(data?.ambassador?.tiers)
      ? data.ambassador.tiers
      : []
  const topTier = tierLadder.length
    ? tierLadder.reduce((best, row) => {
        const pct = Number(row?.payoutRatio || 0)
        const bestPct = Number(best?.payoutRatio || 0)
        return pct >= bestPct ? row : best
      }, tierLadder[0])
    : null
  const topTierName = topTier?.name ? localizeReferralTierName(topTier.name, t) : null
  const topRewardPct = topTier ? Math.max(0, Math.round(Number(topTier.payoutRatio || 0))) : 85

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

  const inviteShareUrl = useMemo(() => {
    const preferred = String(data?.vanityUrl || data?.referralLandingUrl || data?.referralLink || '').trim()
    return formatAmbassadorShareLink(preferred) || preferred
  }, [data?.vanityUrl, data?.referralLandingUrl, data?.referralLink])

  const goToLinkTab = useCallback(() => {
    skipTabScrollTopOnceRef.current = true
    setTabValue('link')
    // After TabsContent mounts, bring the link tools into view.
    window.setTimeout(() => {
      const el = tabsListRef.current
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [])

  const handleHeroShare = useCallback(async () => {
    if (shareBusy || referralLoading) return
    const url = String(inviteShareUrl || '').trim()
    if (!url) {
      goToLinkTab()
      return
    }

    setShareBusy(true)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: getUIText('stage131a5_heroShareCta', language),
            text: getUIText('stage73_shareBodyDefault', language, {
              brand: getSiteDisplayName(),
              link: url,
            }),
            url,
          })
          return
        } catch (err) {
          // User cancelled share sheet — don't treat as error.
          if (err?.name === 'AbortError') return
        }
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        toast.success(t('referralStage726_linkCopied'))
      }
      goToLinkTab()
    } catch {
      goToLinkTab()
    } finally {
      setShareBusy(false)
    }
  }, [shareBusy, referralLoading, inviteShareUrl, goToLinkTab, language, t])

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
      if (skipTabScrollTopOnceRef.current) {
        skipTabScrollTopOnceRef.current = false
      } else {
        window.scrollTo(0, 0)
      }
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

      <Tabs value={tabValue} onValueChange={setTabValue} className="mt-3 space-y-5 max-w-full overflow-x-hidden">
        <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-slate-100">
          <TabsList ref={tabsListRef} className={TABS_LIST_CLASS} data-testid="referral-profile-tabs">
            <TabsTrigger value="overview" className={TAB_ACTIVE}>
              {t('stage131a5_tabOverview')}
            </TabsTrigger>
            <TabsTrigger value="link" className={TAB_ACTIVE}>
              {t('stage1143_tabLink')}
            </TabsTrigger>
            <TabsTrigger value="earnings" className={TAB_ACTIVE}>
              {t('stage1143_tabEarnings')}
            </TabsTrigger>
            <TabsTrigger value="team" className={TAB_ACTIVE}>
              {t('stage1143_tabTeam')}
            </TabsTrigger>
            <TabsTrigger value="history" className={TAB_ACTIVE}>
              {t('stage1143_tabHistory')}
            </TabsTrigger>
            <TabsTrigger value="settings" className={TAB_ACTIVE}>
              {t('stage1143_tabSettings')}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 space-y-5 max-w-full overflow-x-hidden overscroll-x-none">
          <div className="relative z-10 pt-1">
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

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
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
                className="min-h-[44px] w-full sm:w-auto sm:min-w-[11rem] px-4"
                onClick={() => void handleHeroShare()}
                disabled={referralLoading || shareBusy}
                data-testid="referral-hero-share-cta"
              >
                <Share2 className="h-4 w-4 mr-2 shrink-0" aria-hidden />
                <span className="truncate">{t('stage131a5_heroShareCta')}</span>
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
                    rewardPct: nextRewardPct || 75,
                    currentPct: currentRewardPct || 60,
                    sampleAmount: starterPreviewAmount,
                  })
                : adaptiveState === 'early'
                  ? t('stage131a5_adaptive_early', {
                      remaining: remainingToNext ?? 5,
                      nextTier: nextTierName ?? t('stage73_tierFallbackPro'),
                      rewardPct: nextRewardPct || 75,
                      currentPct: currentRewardPct || 60,
                    })
                  : adaptiveState === 'active'
                    ? t('stage131a5_adaptive_active', {
                        earned: formatThbAsDisplay(earnedThb),
                        nextTier: nextTierName ?? 'Gold',
                        remaining: remainingToNext ?? 10,
                        rewardPct: nextRewardPct || 75,
                        currentPct: currentRewardPct || 60,
                      })
                    : t('stage131a5_adaptive_veteran', {
                        earned: formatThbAsDisplay(earnedThb),
                        remainingDiamond: remainingToDiamond ?? 0,
                        rankMonthly: leaderboardRankMonthly != null ? `#${leaderboardRankMonthly}` : '',
                        topTier: topTierName ?? t('stage73_tierFallbackAmbassador'),
                        topPct: topRewardPct || 85,
                      })}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <ReferralCalculatorV2
              compact
              directPartnersInvited={directPartnersInvited}
            />

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
                  <div className="pt-1">
                    <ReferralWithdrawEntryCta walletData={walletData} />
                  </div>
                </CardContent>
              </Card>

              <Card className="gsl-card">
                <CardContent className="p-4 space-y-3">
                  <p className="text-sm font-semibold text-slate-900">{t('stage131a5_progressTitle')}</p>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-800" data-testid="referral-progress-current">
                      {t('stage131a5_progressCurrentWithPct', {
                        tier: currentTierName || '—',
                        pct: currentRewardPct || 60,
                      })}
                    </p>
                    {typeof ambassador?.tierProgressPercent === 'number' ? (
                      <Progress value={Number(ambassador.tierProgressPercent || 0)} className="h-2" />
                    ) : null}

                    {tierLadder.length ? (
                      <ul className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3" data-testid="referral-tier-ladder">
                        {tierLadder.map((row) => {
                          const name = localizeReferralTierName(row?.name, t)
                          const pct = Math.max(0, Math.round(Number(row?.payoutRatio || 0)))
                          const minPartners = Math.max(0, Math.round(Number(row?.minPartnersInvited || 0)))
                          const isCurrent =
                            String(row?.id || '') === String(currentTier?.id || '') ||
                            String(row?.name || '').toLowerCase() === String(currentTier?.name || '').toLowerCase()
                          const unlocked = directPartnersInvited >= minPartners
                          return (
                            <li
                              key={row?.id || row?.name || `${name}-${pct}`}
                              className={
                                isCurrent
                                  ? 'text-sm font-semibold text-brand-hover'
                                  : unlocked
                                    ? 'text-sm text-slate-700'
                                    : 'text-sm text-slate-500'
                              }
                            >
                              {t('stage131a5_progressTierRow', {
                                tier: name,
                                partners: minPartners,
                                pct,
                              })}
                              {isCurrent ? ` · ${t('stage1143_levelCurrent')}` : null}
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}

                    {nextTierName ? (
                      <p className="text-sm text-slate-700">
                        {t('stage131a5_progressNextReward', {
                          pct: nextRewardPct,
                          tier: nextTierName,
                        })}
                      </p>
                    ) : null}

                    {nextTierName && remainingToNext != null ? (
                      <p className="text-sm text-slate-600">
                        {t('stage131a5_progressRemaining', { tier: nextTierName, count: remainingToNext })}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-600">{t('stage131a5_progressMax')}</p>
                    )}

                    {topTierName && nextTierName && topTierName !== nextTierName ? (
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {t('stage131a5_progressGoalHint', {
                          tier: topTierName,
                          pct: topRewardPct || 85,
                        })}
                      </p>
                    ) : null}
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

          <p className="text-xs text-slate-500" data-testid="referral-mlm-persistent-disclaimer">
            {t('referral_mlm_persistent_disclaimer')}
          </p>
        </TabsContent>

        <TabsContent value="link" className="mt-0">
          <ReferralProfileTabLink data={data} walletData={walletData} t={t} locale={locale} welcomeBonusThb={welcomeBonusThb} />
        </TabsContent>
        <TabsContent value="earnings" className="mt-0">
          <ReferralProfileTabEarnings data={data} walletData={walletData} t={t} locale={locale} />
        </TabsContent>
        <TabsContent value="team" className="mt-0">
          <ReferralProfileTabTeam data={data} t={t} locale={locale} language={language} />
        </TabsContent>
        <TabsContent value="history" className="mt-0">
          <ReferralProfileTabHistory data={data} walletData={walletData} t={t} locale={locale} />
        </TabsContent>
        <TabsContent value="settings" className="mt-0">
          <ReferralProfileTabSettings data={data} t={t} />
        </TabsContent>
      </Tabs>

      <MlmConsentModal
        open={consentAt === null && consentModalOpen}
        language={language}
        t={t}
        onOpenChange={(next, meta) => {
          setConsentModalOpen(next)
          if (meta?.consented) setConsentAt(meta.consentAt || new Date().toISOString())
        }}
      />
    </ProductPageShell>
  )
}

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}
