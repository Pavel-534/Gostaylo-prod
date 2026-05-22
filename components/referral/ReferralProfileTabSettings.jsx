'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { REFERRAL_DISPLAY_CURRENCY_CODES, normalizeReferralDisplayCurrency } from '@/lib/finance/referral-display-currency'
import { toast } from 'sonner'

const TZ_FALLBACK_OPTIONS = ['Asia/Bangkok', 'UTC', 'Europe/Moscow', 'Europe/London', 'America/New_York']

export function ReferralProfileTabSettings({ data, t }) {
  const [saving, setSaving] = useState(false)
  const [monthlyGoal, setMonthlyGoal] = useState('10000')
  const [reportTimezone, setReportTimezone] = useState('Asia/Bangkok')
  const [displayCurrency, setDisplayCurrency] = useState('THB')

  const timezoneOptions = useMemo(() => {
    try {
      if (typeof Intl?.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone')
    } catch {
      /* ignore */
    }
    return TZ_FALLBACK_OPTIONS
  }, [])

  useEffect(() => {
    if (!data) return
    const reportPrefs = data?.referralReport || {}
    setMonthlyGoal(String(Number(data?.stats?.monthlyGoalThb ?? reportPrefs?.referralMonthlyGoalThbProfile ?? 10000)))
    setReportTimezone(String(reportPrefs?.ianaTimezone || reportPrefs?.statsCalendarIana || 'Asia/Bangkok'))
    setDisplayCurrency(normalizeReferralDisplayCurrency(data?.stats?.referralDisplayCurrency || 'THB'))
  }, [data])

  async function saveSettings() {
    const goalNum = Number(monthlyGoal || 0)
    if (!Number.isFinite(goalNum) || goalNum < 0) {
      toast.error(t('stage73_profileSaveErr'))
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/v2/profile/me', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referral_monthly_goal_thb: Math.round(goalNum),
          iana_timezone: String(reportTimezone || '').trim() || 'Asia/Bangkok',
          referral_display_currency: normalizeReferralDisplayCurrency(displayCurrency),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.error || 'PROFILE_PATCH_FAILED')
      toast.success(t('stage73_prefsSaved'))
    } catch (e) {
      toast.error(e?.message || t('stage73_profileSaveErr'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="rounded-xl border border-slate-200 bg-white shadow-sm max-w-xl">
      <CardHeader>
        <CardTitle>{t('stage1143_settingsTitle')}</CardTitle>
        <CardDescription>{t('stage1143_settingsSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="referral-goal">{t('stage73_goalLabel')}</Label>
          <Input
            id="referral-goal"
            type="number"
            min={0}
            value={monthlyGoal}
            onChange={(e) => setMonthlyGoal(e.target.value)}
            placeholder={t('stage73_goalPlaceholder')}
          />
        </div>
        <div className="space-y-2">
          <Label>{t('stage73_tzLabel')}</Label>
          <Select value={reportTimezone} onValueChange={setReportTimezone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {timezoneOptions.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('stage1143_displayCurrency')}</Label>
          <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REFERRAL_DISPLAY_CURRENCY_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button className="bg-[#006666] hover:bg-[#005757]" disabled={saving} onClick={() => void saveSettings()}>
          {saving ? '…' : t('stage73_saveReportPrefs')}
        </Button>
      </CardContent>
    </Card>
  )
}
