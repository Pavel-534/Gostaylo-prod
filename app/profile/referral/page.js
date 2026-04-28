'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { Gift, Copy, Loader2, Users, Wallet } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { getSiteDisplayName } from '@/lib/site-url'
import { toast } from 'sonner'
import { UnifiedBalanceSummary } from '@/components/wallet/UnifiedBalanceSummary'
import { ReferralTeamSection } from '@/components/referral/ReferralTeamSection'
import { ReferralActivityFeed } from '@/components/referral/ReferralActivityFeed'
import { ReferralMarketingKit } from '@/components/referral/ReferralMarketingKit'
import { ReferralYourStatusCard } from '@/components/referral/ReferralYourStatusCard'
import { ReferralMonthlyLeaderboard } from '@/components/referral/ReferralMonthlyLeaderboard'
import { ReferralMiniSparkline } from '@/components/referral/ReferralMiniSparkline'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'
import { formatReferralDateDdMmYyyy } from '@/lib/referral/format-referral-datetime'
import { isValidIanaTimeZone } from '@/lib/referral/resolve-referral-stats-timezone'
import { formatPrice } from '@/lib/currency'
import {
  normalizeReferralDisplayCurrency,
  REFERRAL_DISPLAY_CURRENCY_CODES,
} from '@/lib/finance/referral-display-currency'
import { playReferralAchievementChime } from '@/lib/referral/referral-achievement-chime'

const REPORT_TZ_OPTIONS = ['Asia/Bangkok', 'Asia/Singapore', 'Europe/Moscow', 'Asia/Dubai', 'UTC']

/** Базовая строка для сравнения «новый партнёр по ссылке» (toast). */
const REF_FRIENDS_SEEN_STORAGE = 'gostaylo:lastReferralFriendsCount'
/** Последний известный `referral_team_events.id` (teammate_joined) — точнее счётчика (Stage 74.4). */
const REF_JOIN_EVENT_SEEN_STORAGE = 'gostaylo:lastReferralTeammateJoinEventId'
/** Baseline digest медалей — «дзынь» только при появлении нового id (Stage 76.1). */
const REF_BADGE_SEEN_STORAGE = 'gostaylo:referralGamificationSeenBadges:v1'

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
  const [reportTz, setReportTz] = useState('UTC')
  const [reportGoalInput, setReportGoalInput] = useState('')
  const [prefsSaving, setPrefsSaving] = useState(false)
  const [currencySaving, setCurrencySaving] = useState(false)
  const [fairRateMap, setFairRateMap] = useState(null)
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState(null)
  const [displayCurrency, setDisplayCurrency] = useState('THB')
  const silentTzSyncRef = useRef(false)
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
            const d = json.data || null
            setData(d)
            try {
              if (d?.stats?.friendsInvited != null && sessionStorage.getItem(REF_FRIENDS_SEEN_STORAGE) == null) {
                sessionStorage.setItem(REF_FRIENDS_SEEN_STORAGE, String(Number(d.stats.friendsInvited)))
              }
              if (sessionStorage.getItem(REF_JOIN_EVENT_SEEN_STORAGE) == null) {
                sessionStorage.setItem(
                  REF_JOIN_EVENT_SEEN_STORAGE,
                  d?.referralLastTeammateJoinEventId ? String(d.referralLastTeammateJoinEventId) : '',
                )
              }
            } catch {
              /* ignore */
            }
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

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        // Амбассадорам показываем чистый биржевой курс, наценка 2.5% применяется только к рентерам.
        const res = await fetch('/api/v2/exchange-rates?retail=0', { cache: 'no-store' })
        const j = await res.json().catch(() => ({}))
        if (!cancelled && j?.success) {
          if (j?.rateMap && typeof j.rateMap === 'object') {
            setFairRateMap({ THB: 1, ...j.rateMap })
          }
          setRatesUpdatedAt(j?.ratesUpdatedAt ? String(j.ratesUpdatedAt) : null)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const c = normalizeReferralDisplayCurrency(data?.stats?.referralDisplayCurrency)
    setDisplayCurrency(c)
  }, [data?.stats?.referralDisplayCurrency])

  useEffect(() => {
    if (loading || !data?.referralGamification) return
    const ids = Array.isArray(data.referralGamification.badgesEarned)
      ? [...data.referralGamification.badgesEarned].map((x) => String(x)).sort()
      : []
    let prev = []
    try {
      const raw = sessionStorage.getItem(REF_BADGE_SEEN_STORAGE)
      if (raw) prev = JSON.parse(raw)
    } catch {
      prev = []
    }
    if (!Array.isArray(prev)) prev = []
    if (prev.length === 0) {
      try {
        sessionStorage.setItem(REF_BADGE_SEEN_STORAGE, JSON.stringify(ids))
      } catch {
        /* ignore */
      }
      return
    }
    const prevSet = new Set(prev.map((x) => String(x)))
    const hasNew = ids.some((id) => !prevSet.has(id))
    try {
      sessionStorage.setItem(REF_BADGE_SEEN_STORAGE, JSON.stringify(ids))
    } catch {
      /* ignore */
    }
    if (hasNew && ids.length) {
      window.setTimeout(() => playReferralAchievementChime(), 120)
    }
  }, [data, loading])

  useEffect(() => {
    const rr = data?.referralReport
    if (!rr) return
    setReportTz(String(rr.ianaTimezone || 'UTC'))
    const pg = rr.referralMonthlyGoalThbProfile
    setReportGoalInput(pg != null && pg !== '' ? String(pg) : '')
  }, [data?.referralReport])

  /** Stage 73.7: без плашек — если TZ в профиле пуст, один раз подставляем IANA из браузера и перезагружаем stats. */
  useEffect(() => {
    if (!data?.referralReport || silentTzSyncRef.current) return
    const stored = String(data.referralReport.ianaTimezone ?? '').trim()
    if (stored) return
    if (typeof window === 'undefined' || typeof Intl === 'undefined') return
    let browserTz = ''
    try {
      browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    } catch {
      return
    }
    if (!browserTz || !isValidIanaTimeZone(browserTz)) return
    silentTzSyncRef.current = true
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/v2/profile/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ iana_timezone: browserTz }),
        })
        const json = await res.json().catch(() => ({}))
        if (cancelled || !res.ok || !json?.success) {
          silentTzSyncRef.current = false
          return
        }
        const refRes = await fetch('/api/v2/referral/me', { credentials: 'include', cache: 'no-store' })
        const refJson = await refRes.json().catch(() => ({}))
        if (!cancelled && refRes.ok && refJson?.success) setData(refJson.data || null)
      } catch {
        silentTzSyncRef.current = false
      }
    })()
    return () => {
      cancelled = true
    }
  }, [data?.referralReport])

  /** Live: новая регистрация по ссылке → toast (без WebSocket). */
  useEffect(() => {
    if (!isAuthenticated || authLoading || loading) return
    const id = window.setInterval(async () => {
      try {
        const refRes = await fetch('/api/v2/referral/me', { credentials: 'include', cache: 'no-store' })
        const json = await refRes.json().catch(() => ({}))
        if (!refRes.ok || !json?.success || !json.data) return
        const next = json.data
        const cur = Number(next?.stats?.friendsInvited ?? 0)
        const nextJoinId = next?.referralLastTeammateJoinEventId ? String(next.referralLastTeammateJoinEventId) : ''
        let prevJoin = ''
        let prevFriendsStored = ''
        try {
          prevJoin = sessionStorage.getItem(REF_JOIN_EVENT_SEEN_STORAGE) ?? ''
          prevFriendsStored = sessionStorage.getItem(REF_FRIENDS_SEEN_STORAGE) ?? ''
        } catch {
          prevJoin = ''
          prevFriendsStored = ''
        }
        let showPartnerToast = false
        if (nextJoinId) {
          if (prevJoin !== '' && nextJoinId !== prevJoin) showPartnerToast = true
          else if (!prevJoin && prevFriendsStored !== '') {
            const prevN = Number(prevFriendsStored)
            if (Number.isFinite(prevN) && cur > prevN) showPartnerToast = true
          }
          try {
            sessionStorage.setItem(REF_JOIN_EVENT_SEEN_STORAGE, nextJoinId)
          } catch {
            /* ignore */
          }
        } else if (prevFriendsStored !== '') {
          const prevFriends = Number(prevFriendsStored)
          if (Number.isFinite(prevFriends) && cur > prevFriends) showPartnerToast = true
        }
        if (showPartnerToast) toast.success(t('stage74_3_newPartnerToast'))
        try {
          sessionStorage.setItem(REF_FRIENDS_SEEN_STORAGE, String(cur))
        } catch {
          /* ignore */
        }
        setData(next)
      } catch {
        /* ignore */
      }
    }, 56000)
    return () => clearInterval(id)
  }, [isAuthenticated, authLoading, loading, t])

  const sparkTooltip14d = useMemo(() => {
    const end = new Date()
    const start = new Date(Date.now() - 13 * 86400000)
    return t('stage73_sparkTooltip14d')
      .replace('{from}', formatReferralDateDdMmYyyy(start))
      .replace('{to}', formatReferralDateDdMmYyyy(end))
  }, [t])

  const sparkTooltipYtd = useMemo(() => {
    return t('stage73_sparkTooltipYtd').replace('{year}', String(new Date().getFullYear()))
  }, [t])

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

  async function handleCopyLanding() {
    const url = String(data?.referralLandingUrl || '').trim()
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t('referralStage726_linkCopied'))
    } catch {
      toast.error(t('referralStage726_copyFail'))
    }
  }

  async function saveReportPrefs() {
    setPrefsSaving(true)
    try {
      const goalRaw = String(reportGoalInput || '').trim()
      if (goalRaw !== '') {
        const gn = Number(goalRaw)
        if (!Number.isFinite(gn) || gn < 0 || gn > 999999999) {
          toast.error(t('referralStage726_loadErr'))
          return
        }
      }
      const body = {
        iana_timezone: reportTz,
        referral_monthly_goal_thb: goalRaw === '' ? null : Number(goalRaw),
      }
      const res = await fetch('/api/v2/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        toast.error(json?.error || t('stage73_profileSaveErr'))
        return
      }
      toast.success(t('stage73_prefsSaved'))
      const refRes = await fetch('/api/v2/referral/me', { credentials: 'include', cache: 'no-store' })
      const refJson = await refRes.json().catch(() => ({}))
      if (refRes.ok && refJson?.success) setData(refJson.data || null)
    } catch {
      toast.error(t('referralStage726_pageErr'))
    } finally {
      setPrefsSaving(false)
    }
  }

  async function saveReferralDisplayCurrency(nextRaw) {
    const next = normalizeReferralDisplayCurrency(nextRaw)
    setCurrencySaving(true)
    try {
      const res = await fetch('/api/v2/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ referral_display_currency: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        toast.error(json?.error || t('stage73_profileSaveErr'))
        return
      }
      setDisplayCurrency(next)
      toast.success(t('stage73_prefsSaved'))
      const refRes = await fetch('/api/v2/referral/me', { credentials: 'include', cache: 'no-store' })
      const refJson = await refRes.json().catch(() => ({}))
      if (refRes.ok && refJson?.success) setData(refJson.data || null)
    } catch {
      toast.error(t('referralStage726_pageErr'))
    } finally {
      setCurrencySaving(false)
    }
  }

  function pluralDays(n) {
    if (language === 'en') return n === 1 ? t('referralStage726_day') : t('referralStage726_days5')
    return n === 1 ? t('referralStage726_day') : n >= 2 && n <= 4 ? t('referralStage726_days2') : t('referralStage726_days5')
  }

  const tzSelectOptions = useMemo(() => {
    const o = [...REPORT_TZ_OPTIONS]
    if (reportTz && !o.includes(reportTz)) o.unshift(reportTz)
    return o
  }, [reportTz])

  const ledgerBase = data?.stats?.ledgerBaseCurrency || 'THB'
  const ratesFreshnessLabel = useMemo(() => {
    if (!ratesUpdatedAt) return ''
    const ts = Date.parse(ratesUpdatedAt)
    if (!Number.isFinite(ts)) return ''
    const mins = Math.max(0, Math.round((Date.now() - ts) / 60000))
    return t('stage76_ratesUpdatedAgo').replace('{mins}', String(mins))
  }, [ratesUpdatedAt, t])

  const dualMoney = useMemo(() => {
    const map = fairRateMap && typeof fairRateMap === 'object' ? fairRateMap : { THB: 1 }
    const cur = normalizeReferralDisplayCurrency(displayCurrency)
    return {
      cur,
      primary(amountThb) {
        const n = Number(amountThb) || 0
        if (cur === 'THB') return `฿${formatThb(n, locale)}`
        return formatPrice(n, cur, map, language)
      },
      thPlain(amountThb) {
        const n = Number(amountThb) || 0
        return `฿${formatThb(n, locale)}`
      },
      thbLedgerLine(amountThb) {
        const n = Number(amountThb) || 0
        return t('stage76_ambassadorDualThb')
          .replace('{amt}', formatThb(n, locale))
          .replace('{ledgerBase}', ledgerBase)
      },
      leaderboardCell(amountThb) {
        const n = Number(amountThb) || 0
        if (cur === 'THB') return `฿${formatThb(n, locale)}`
        return `${formatPrice(n, cur, map, language)} · ${formatThb(n, locale)} ${ledgerBase}`
      },
    }
  }, [fairRateMap, displayCurrency, locale, language, t, ledgerBase])

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

  const localizedShareBody = useMemo(() => {
    const brand = String(data?.brandName || '').trim() || getSiteDisplayName()
    const shareLink =
      String(data?.referralLandingUrl || '').trim() || String(data?.referralLink || '').trim()
    return t('stage73_shareBodyDefault').replace('{brand}', brand).replace('{link}', shareLink)
  }, [data?.brandName, data?.referralLandingUrl, data?.referralLink, t])

  const storiesTierStatusLine = useMemo(() => {
    const brand = String(data?.brandName || '').trim() || 'Platform'
    const tierName =
      String(data?.ambassador?.currentTier?.name || '').trim() || t('stage73_tierFallbackBeginner')
    const badge =
      String(data?.marketingCard?.ambassadorBadge || '').toLowerCase() === 'gold'
        ? t('stage73_badgeGold')
        : t('stage73_badgeSilver')
    return t('stage74_storiesTierLine')
      .replace('{brand}', brand)
      .replace('{tier}', tierName)
      .replace('{badge}', badge)
  }, [data?.brandName, data?.ambassador?.currentTier?.name, data?.marketingCard?.ambassadorBadge, t])

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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between px-0.5 -mb-1">
        <p className="text-[11px] text-slate-500">{t('stage73_referralStatsTzHint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-[11px] text-slate-600 shrink-0">{t('stage76_referralDisplayCurrencyLabel')}</Label>
          <select
            className="h-9 min-w-[7rem] rounded-md border border-input bg-background px-2 py-1 text-sm disabled:opacity-60"
            value={dualMoney.cur}
            disabled={currencySaving}
            onChange={(e) => void saveReferralDisplayCurrency(e.target.value)}
            aria-label={t('stage76_referralDisplayCurrencyLabel')}
          >
            {REFERRAL_DISPLAY_CURRENCY_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          {currencySaving ? <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden /> : null}
        </div>
      </div>
      <p className="text-[10px] text-slate-500 px-0.5 -mt-1">{t('stage76_referralDisplayCurrencyHint')}</p>
      {ratesFreshnessLabel ? <p className="text-[10px] text-slate-500 px-0.5 -mt-1">{ratesFreshnessLabel}</p> : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-slate-500">{t('referralStage726_statMonthlyEarned')}</p>
            <div className="flex flex-row items-start justify-between gap-2">
              <p className="text-xl font-semibold text-teal-800 flex items-start gap-2 min-w-0">
                <Wallet className="h-4 w-4 shrink-0 mt-0.5" />{' '}
                <span className="tabular-nums inline-flex flex-col gap-0.5">
                  <span>{dualMoney.primary(data?.stats?.monthlyEarnedThb ?? 0)}</span>
                  {dualMoney.cur !== 'THB' ? (
                    <span className="text-[11px] font-normal text-slate-600 leading-snug">
                      {dualMoney.thbLedgerLine(data?.stats?.monthlyEarnedThb ?? 0)}
                    </span>
                  ) : null}
                </span>
              </p>
              <ReferralMiniSparkline
                tooltip={sparkTooltip14d}
                values={Array.isArray(data?.stats?.sparklineEarningsThb) ? data.stats.sparklineEarningsThb : []}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-slate-500">{t('stage73_statYearlyEarned')}</p>
            <div className="flex flex-row items-start justify-between gap-2">
              <p className="text-xl font-semibold text-teal-900 flex items-start gap-2 min-w-0">
                <Wallet className="h-4 w-4 shrink-0 mt-0.5" />{' '}
                <span className="tabular-nums inline-flex flex-col gap-0.5">
                  <span>{dualMoney.primary(data?.stats?.yearlyEarnedThb ?? 0)}</span>
                  {dualMoney.cur !== 'THB' ? (
                    <span className="text-[11px] font-normal text-slate-600 leading-snug">
                      {dualMoney.thbLedgerLine(data?.stats?.yearlyEarnedThb ?? 0)}
                    </span>
                  ) : null}
                </span>
              </p>
              <ReferralMiniSparkline
                strokeClassName="text-indigo-600"
                tooltip={sparkTooltipYtd}
                values={
                  Array.isArray(data?.stats?.sparkMonthlyYtdThb) ? data.stats.sparkMonthlyYtdThb : []
                }
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-2">
            <p className="text-xs text-slate-500">{t('referralStage726_statExpectedPending')}</p>
            <p className="text-xl font-semibold text-sky-800 flex items-start gap-2">
              <Wallet className="h-4 w-4 shrink-0 mt-0.5" />{' '}
              <span className="tabular-nums inline-flex flex-col gap-0.5">
                <span>{dualMoney.primary(data?.stats?.expectedPendingThb ?? 0)}</span>
                {dualMoney.cur !== 'THB' ? (
                  <span className="text-[11px] font-normal text-slate-600 leading-snug">
                    {dualMoney.thbLedgerLine(data?.stats?.expectedPendingThb ?? 0)}
                  </span>
                ) : null}
              </span>
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
            <p className="text-xl font-semibold text-emerald-700 flex items-start gap-2">
              <Wallet className="h-4 w-4 shrink-0 mt-0.5" />{' '}
              <span className="tabular-nums inline-flex flex-col gap-0.5">
                <span>{dualMoney.primary(data?.stats?.earnedThb ?? 0)}</span>
                {dualMoney.cur !== 'THB' ? (
                  <span className="text-[11px] font-normal text-slate-600 leading-snug">
                    {dualMoney.thbLedgerLine(data?.stats?.earnedThb ?? 0)}
                  </span>
                ) : null}
              </span>
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

      <Card className="border border-slate-200 bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t('stage74_l1l2Title')}</CardTitle>
          <CardDescription className="text-xs">{t('stage74_l1l2Hint')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-lg border border-teal-100 bg-teal-50/40 px-4 py-3">
            <p className="text-xs text-slate-600">{t('stage74_statL1Monthly')}</p>
            <span className="text-lg font-semibold text-teal-900 tabular-nums mt-1 inline-flex flex-col gap-0.5">
              <span>{dualMoney.primary(data?.stats?.monthlyL1EarnedThb ?? 0)}</span>
              {dualMoney.cur !== 'THB' ? (
                <span className="text-[11px] font-normal text-slate-600">
                  {dualMoney.thbLedgerLine(data?.stats?.monthlyL1EarnedThb ?? 0)}
                </span>
              ) : null}
            </span>
          </div>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 px-4 py-3">
            <p className="text-xs text-slate-600">{t('stage74_statL2Monthly')}</p>
            <span className="text-lg font-semibold text-indigo-900 tabular-nums mt-1 inline-flex flex-col gap-0.5">
              <span>{dualMoney.primary(data?.stats?.monthlyNetworkEarnedThb ?? 0)}</span>
              {dualMoney.cur !== 'THB' ? (
                <span className="text-[11px] font-normal text-slate-600">
                  {dualMoney.thbLedgerLine(data?.stats?.monthlyNetworkEarnedThb ?? 0)}
                </span>
              ) : null}
            </span>
          </div>
        </CardContent>
      </Card>

      <ReferralYourStatusCard
        t={t}
        locale={locale}
        ambassador={data?.ambassador}
        badgesEarned={data?.referralGamification?.badgesEarned}
        statusSubtitle={ambassadorSubtitle}
        brandName={data?.brandName || ''}
        displayName={data?.marketingCard?.displayName || ''}
        ledgerFootnote={dualMoney.cur !== 'THB' ? t('stage76_referralDisplayCurrencyHint') : ''}
      />

      <ReferralMonthlyLeaderboard
        t={t}
        formatThb={formatThb}
        formatAmountLine={(n) => dualMoney.leaderboardCell(n)}
        locale={locale}
      />

      <ReferralTeamSection members={data?.teamMembers || []} t={t} language={language} />

      <ReferralMarketingKit
        referralLink={data?.referralLink || ''}
        landingShareUrl={data?.referralLandingUrl || ''}
        landingShortLabel={data?.referralLandingShortDisplay || ''}
        shareBody={localizedShareBody}
        shareMessage={data?.shareMessage || ''}
        code={data?.code || ''}
        brandName={data?.brandName || ''}
        displayName={data?.marketingCard?.displayName || ''}
        ambassadorBadge={data?.marketingCard?.ambassadorBadge || 'silver'}
        directPartnersInvitedCount={Number(
          data?.stats?.directPartnersInvited ?? data?.ambassador?.directPartnersInvited ?? 0,
        )}
        storiesTeamLockedHint={t('stage75_storiesTeamLocked')}
        pdfButtonLabel={t('stage73_pdfCard')}
        pdfCtaLine={t('stage73_pdfCta')}
        pdfOfficialStatusLine={t('stage73_pdfOfficialStatus')}
        pdfBrandSubtitle={t('stage73_brandSubtitle')}
        pdfElitePartner={
          Array.isArray(data?.referralGamification?.badgesEarned) &&
          data.referralGamification.badgesEarned.includes('top10_monthly')
        }
        pdfElitePartnerLine={t('stage75_pdfElitePartner')}
        badgeGoldLabel={t('stage73_badgeGold')}
        badgeSilverLabel={t('stage73_badgeSilver')}
        marketingTitle={t('stage73_marketingKitTitle')}
        marketingSubtitle={t('stage73_marketingKitSubtitle')}
        downloadLabel={t('stage73_downloadQr')}
        shareFbLabel={t('stage73_shareFb')}
        shareTgLabel={t('referralStage726_shareTg')}
        shareWaLabel={t('referralStage726_shareWa')}
        storiesDownloadLabel={t('stage73_downloadStoriesCard')}
        storiesCardHeadline={t('stage73_storiesCardHeadline')}
        storiesTierStatusLine={storiesTierStatusLine}
        storiesAmbassadorBadgeLine={data?.referralStoriesCopy?.ambassadorBadgeLine || ''}
        storiesTeamHeadline={data?.referralStoriesCopy?.teamHeadline || ''}
        storiesTeamAmountLine={data?.referralStoriesCopy?.teamAmountLine || ''}
        storiesTeamCtaLine={data?.referralStoriesCopy?.teamCtaLine || ''}
        storiesTeamDownloadLabel={t('stage74_storiesTeamDownload')}
      />

      <Card className="border border-slate-200 bg-white">
        <CardHeader className="pb-2 space-y-1">
          <CardTitle className="text-base">{t('stage73_monthlyGoalTitle')}</CardTitle>
          <p className="text-sm font-medium text-slate-800 leading-snug">
            {t('stage73_monthlyGoalPercentLine')
              .replace('{goal}', dualMoney.primary(data?.stats?.monthlyGoalThb ?? 0))
              .replace(
                '{percent}',
                String(Math.round(Number(data?.stats?.monthlyGoalProgressPercent || 0))),
              )}
          </p>
          <CardDescription className="text-xs">
            {t('stage73_monthlyGoalProgress')
              .replace('{current}', dualMoney.primary(data?.stats?.monthlyEarnedThb ?? 0))
              .replace('{goal}', dualMoney.primary(data?.stats?.monthlyGoalThb ?? 0))}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Progress value={Number(data?.stats?.monthlyGoalProgressPercent || 0)} className="h-2" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{t('stage73_tzLabel')}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={reportTz}
                onChange={(e) => setReportTz(e.target.value)}
              >
                {tzSelectOptions.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t('stage73_goalLabel')}</Label>
              <Input
                type="number"
                min={0}
                step={100}
                placeholder={t('stage73_goalPlaceholder')}
                value={reportGoalInput}
                onChange={(e) => setReportGoalInput(e.target.value)}
              />
            </div>
          </div>
          <Button type="button" size="sm" onClick={() => void saveReportPrefs()} disabled={prefsSaving}>
            {prefsSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('stage73_saveReportPrefs')}
          </Button>
        </CardContent>
      </Card>

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
              {t('referralStage726_payoutMin').replace('{amount}', dualMoney.primary(walletData.payout.minPayoutThb ?? 0))}{' '}
              ({ledgerBase})
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
              {t('referralStage726_withdrawableLabel')}: {dualMoney.primary(payoutProgress.withdrawable)} ({ledgerBase}) ·{' '}
              {t('referralStage726_internalServicesLabel')}: {dualMoney.primary(payoutProgress.internal)} ({ledgerBase})
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
          {data?.referralLandingUrl ? (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">{t('stage74_3_shortLandingLabel')}</p>
              <div className="flex gap-2">
                <Input value={data.referralLandingUrl} readOnly className="font-mono text-xs" />
                <Button type="button" variant="secondary" onClick={() => void handleCopyLanding()}>
                  <Copy className="h-4 w-4 mr-1" />
                  {t('referralStage726_copy')}
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">{t('stage74_3_shortLandingHint')}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {data?.turbo?.enabled === true && Number(data?.turbo?.promoBoostPerBookingThb || 0) > 0 ? (
        <Card className="border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-yellow-50 to-white shadow-sm">
          <CardHeader>
            <CardTitle className="text-amber-900">{t('referralStage726_turboTitle')}</CardTitle>
            <CardDescription className="text-amber-800">
              {t('referralStage726_turboDesc')} +{dualMoney.primary(data?.turbo?.promoBoostPerBookingThb ?? 0)} (
              {ledgerBase})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-slate-700">{t('referralStage726_turboBoostLine')}</p>
            <p className="text-xl font-bold text-amber-700">
              <span className="line-through text-slate-400 mr-2">
                +{dualMoney.primary(data?.turbo?.oldReferrerBonusWithBoostThb ?? 0)}
              </span>
              +{dualMoney.primary(data?.turbo?.newReferrerBonusWithBoostThb ?? 0)}
            </p>
          </CardContent>
        </Card>
      ) : null}

    </div>
  )
}
