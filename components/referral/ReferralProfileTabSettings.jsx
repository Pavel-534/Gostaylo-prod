'use client'

import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  MOBILE_FLAT_CARD_CLASS,
  MOBILE_FLAT_CARD_CONTENT_CLASS,
  MOBILE_FLAT_CARD_HEADER_CLASS,
  MOBILE_FLAT_INSET_CLASS,
} from '@/lib/ui/mobile-flat-canvas'

const TZ_FALLBACK_OPTIONS = ['Asia/Bangkok', 'UTC', 'Europe/Moscow', 'Europe/London', 'America/New_York']

export function ReferralProfileTabSettings({ data, t }) {
  const [saving, setSaving] = useState(false)
  const [monthlyGoal, setMonthlyGoal] = useState('10000')
  const [reportTimezone, setReportTimezone] = useState('Asia/Bangkok')
  const [campaignLoading, setCampaignLoading] = useState(false)
  const [campaignSaving, setCampaignSaving] = useState(false)
  const [campaignOptions, setCampaignOptions] = useState([])
  const [campaignSlug, setCampaignSlug] = useState('__none__')

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
  }, [data])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setCampaignLoading(true)
      try {
        const res = await fetch('/api/v2/referral/campaign-binding', { credentials: 'include', cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok || !json?.success) return
        if (cancelled) return
        const options = Array.isArray(json?.data?.campaigns) ? json.data.campaigns : []
        setCampaignOptions(options)
        setCampaignSlug(json?.data?.campaignSlug || '__none__')
      } finally {
        if (!cancelled) setCampaignLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

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

  async function saveCampaignBinding() {
    setCampaignSaving(true)
    try {
      const res = await fetch('/api/v2/referral/campaign-binding', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignSlug: campaignSlug === '__none__' ? null : campaignSlug,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) throw new Error(json?.error || 'CAMPAIGN_BIND_SAVE_FAILED')
      toast.success(t('stage1143_campaignSaved'))
    } catch (e) {
      toast.error(e?.message || t('stage1143_campaignSaveErr'))
    } finally {
      setCampaignSaving(false)
    }
  }

  return (
    <Card className={cn(MOBILE_FLAT_CARD_CLASS, 'max-w-xl')}>
      <CardHeader className={MOBILE_FLAT_CARD_HEADER_CLASS}>
        <CardTitle>{t('stage1143_settingsTitle')}</CardTitle>
        <CardDescription>{t('stage1143_settingsSubtitle')}</CardDescription>
      </CardHeader>
      <CardContent className={cn(MOBILE_FLAT_CARD_CONTENT_CLASS, 'space-y-4')}>
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
        <Button variant="brand" disabled={saving} onClick={() => void saveSettings()}>
          {saving ? '…' : t('stage73_saveReportPrefs')}
        </Button>
        <div className={cn(MOBILE_FLAT_INSET_CLASS, 'space-y-2')}>
          <Label>{t('stage1143_campaignLabel')}</Label>
          <Select value={campaignSlug} onValueChange={setCampaignSlug} disabled={campaignLoading}>
            <SelectTrigger>
              <SelectValue placeholder={t('stage1143_campaignNone')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">{t('stage1143_campaignNone')}</SelectItem>
              {campaignOptions.map((row) => (
                <SelectItem key={row.slug} value={row.slug}>
                  {row.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">{t('stage1143_campaignHint')}</p>
          <Button variant="outline" disabled={campaignSaving || campaignLoading} onClick={() => void saveCampaignBinding()}>
            {campaignSaving ? t('stage1143_campaignSaving') : t('stage1143_campaignSave')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
