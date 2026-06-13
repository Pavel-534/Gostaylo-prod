'use client'

import { useEffect, useMemo, useState } from 'react'
import { useReferralMeQuery } from '@/lib/hooks/use-referral-me'
import { useRouter } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { ProfileHubNav } from '@/components/product/ProfileHubNav'
import { ProductPageShell } from '@/components/product/ProductPageShell'
import { LoadingPageShell } from '@/components/product/LoadingPageShell'
import { PageSectionHeader } from '@/components/product/PageSectionHeader'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useAuth } from '@/contexts/auth-context'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { toast } from 'sonner'
import { ReferralYourStatusCard } from '@/components/referral/ReferralYourStatusCard'
import { ReferralActivityFeed } from '@/components/referral/ReferralActivityFeed'
import { ReferralMonthlyLeaderboard } from '@/components/referral/ReferralMonthlyLeaderboard'
import { ReferralTeamSection } from '@/components/referral/ReferralTeamSection'
import { ReferralBalanceBreakdown } from '@/components/referral/ReferralBalanceBreakdown'
import { useWalletMeQuery } from '@/lib/hooks/use-wallet-me'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

const TZ_FALLBACK_OPTIONS = ['Asia/Bangkok', 'UTC', 'Europe/Moscow', 'Europe/London', 'America/New_York']

export default function ProfileStatusPage() {
  const router = useRouter()
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const locale = language === 'en' ? 'en-US' : language === 'th' ? 'th-TH' : language === 'zh' ? 'zh-CN' : 'ru-RU'
  const { isAuthenticated, loading: authLoading } = useAuth()
  const [profileSaving, setProfileSaving] = useState(false)
  const {
    data,
    isLoading: referralLoading,
    isError: referralError,
  } = useReferralMeQuery({
    enabled: !authLoading && isAuthenticated,
    includeTeam: true,
    teamLimit: 40,
  })
  const { data: walletData } = useWalletMeQuery({
    enabled: !authLoading && isAuthenticated,
  })
  const [monthlyGoal, setMonthlyGoal] = useState('10000')
  const [reportTimezone, setReportTimezone] = useState('Asia/Bangkok')

  const timezoneOptions = useMemo(() => {
    try {
      if (typeof Intl?.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone')
    } catch {}
    return TZ_FALLBACK_OPTIONS
  }, [])

  useEffect(() => {
    if (authLoading) return
    if (!isAuthenticated) {
      router.replace('/profile?login=true')
      return
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (!data) return
    const reportPrefs = data?.referralReport || {}
    setMonthlyGoal(String(Number(reportPrefs?.monthlyGoalThb ?? 10000)))
    setReportTimezone(String(reportPrefs?.timezone || 'Asia/Bangkok'))
  }, [data])

  useEffect(() => {
    if (referralError) toast.error(t('referralStage726_loadErr'))
  }, [referralError, t])

  async function saveAdvancedSettings() {
    const goalNum = Number(monthlyGoal || 0)
    if (!Number.isFinite(goalNum) || goalNum < 0) {
      toast.error('Введите корректную сумму цели')
      return
    }
    setProfileSaving(true)
    try {
      const res = await fetch('/api/v2/profile/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_monthly_goal_thb: Math.round(goalNum),
          iana_timezone: String(reportTimezone || '').trim() || 'Asia/Bangkok',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.error || 'PROFILE_PATCH_FAILED')
      toast.success('Настройки профиля сохранены')
    } catch (e) {
      toast.error(e?.message || 'Не удалось сохранить настройки профиля')
    } finally {
      setProfileSaving(false)
    }
  }

  if (authLoading || referralLoading) {
    return <LoadingPageShell label={t('referralStage726_load')} />
  }

  const brand = String(data?.brandName || '').trim() || 'Platform'
  const displayName = String(data?.marketingCard?.displayName || '').trim() || 'Ambassador'
  const turboMultiplier = Number(data?.turbo?.multiplier || data?.ambassador?.turboMultiplier || 1)

  return (
    <ProductPageShell containerClassName="space-y-8 sm:space-y-10">
      <ProfileHubNav t={t} />
      <PageSectionHeader title={t('stage1143_tabNavStatus')} subtitle={t('stage1143_settingsSubtitle')} />

      <ReferralBalanceBreakdown walletData={walletData} referralData={data} locale={locale} variant="compact" />

        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8">
            <ReferralYourStatusCard
              t={t}
              locale={locale}
              ambassador={data?.ambassador}
              badgesEarned={data?.referralGamification?.badgesEarned}
              statusSubtitle=""
              brandName={brand}
              displayName={displayName}
              ledgerFootnote=""
              turboMultiplier={turboMultiplier}
            />
          </div>
          <Card className="md:col-span-4 rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-2"><CardTitle className="text-base">Прогресс и цель</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-700">
              {Array.isArray(data?.referralGamification?.badgesEarned) && data.referralGamification.badgesEarned.length
                ? `У вас ${data.referralGamification.badgesEarned.length} медалей. Следующий шаг уже в прогрессе.`
                : 'Медали появятся после первых активностей. Первая цель — 3 активных приглашения.'}
            </CardContent>
          </Card>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-4">
            <ReferralMonthlyLeaderboard t={t} formatThb={formatThb} locale={locale} />
          </div>
          <div className="md:col-span-8">
            <ReferralActivityFeed />
          </div>
        </section>

        {Array.isArray(data?.teamMembers) && data.teamMembers.length > 0 ? (
          <ReferralTeamSection members={data.teamMembers} t={t} language={language} />
        ) : (
          <Card className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md">
            <CardHeader className="pb-2"><CardTitle className="text-base">Ваша команда</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600">
              Здесь будет список ваших первых героев.
              <div className="mt-2 flex items-center gap-2 text-slate-500">
                <ArrowRight className="h-4 w-4" />
                Начните с 1 приглашения — и команда появится здесь.
              </div>
            </CardContent>
          </Card>
        )}

        <Accordion type="single" collapsible className="w-full border rounded-xl px-3 shadow-sm bg-white">
          <AccordionItem value="advanced-profile-settings" className="border-b-0">
            <AccordionTrigger>Настройки профиля</AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="monthly-goal-thb">Моя цель на месяц (THB)</Label>
                  <Input id="monthly-goal-thb" type="number" min={0} step={100} value={monthlyGoal} onChange={(e) => setMonthlyGoal(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="referral-timezone">Таймзона статистики</Label>
                  <Select value={reportTimezone} onValueChange={setReportTimezone}>
                    <SelectTrigger id="referral-timezone"><SelectValue placeholder="Asia/Bangkok" /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {timezoneOptions.map((tz) => (
                        <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="button" variant="brand" onClick={() => void saveAdvancedSettings()} disabled={profileSaving}>
                {profileSaving ? 'Сохраняем…' : 'Сохранить настройки'}
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
    </ProductPageShell>
  )
}
