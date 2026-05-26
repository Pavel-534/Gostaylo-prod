'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Shield, AlertTriangle, Trash2, Plus, RefreshCw, BarChart3, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

export default function SecurityPage() {
  const { toast } = useToast()
  const { language } = useI18n()
  const t = useCallback((key) => getUIText(key, language), [language])

  const [blacklist, setBlacklist] = useState({ wallets: [], phones: [] })
  const [loading, setLoading] = useState(true)
  const [showWalletModal, setShowWalletModal] = useState(false)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [newWallet, setNewWallet] = useState({ address: '', reason: '' })
  const [newPhone, setNewPhone] = useState({ number: '', reason: '' })

  const [leakLoading, setLeakLoading] = useState(false)
  const [leakData, setLeakData] = useState(null)
  const [leakError, setLeakError] = useState(false)

  const loadBlacklist = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/blacklist', { credentials: 'include', cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.data) {
        setBlacklist({
          wallets: Array.isArray(json.data.wallets) ? json.data.wallets : [],
          phones: Array.isArray(json.data.phones) ? json.data.phones : [],
        })
      } else if (!res.ok) {
        toast({
          title: t('adminSecurity_toastError'),
          description: json.error || String(res.status),
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to load blacklist:', error)
      toast({ title: t('adminSecurity_toastError'), variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [t, toast])

  const loadLeakDashboard = useCallback(async () => {
    setLeakLoading(true)
    setLeakError(false)
    try {
      const res = await fetch('/api/v2/admin/contact-leak-dashboard', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || !json.success) {
        setLeakError(true)
        setLeakData(null)
        return
      }
      setLeakData(json.data)
    } catch (e) {
      console.error(e)
      setLeakError(true)
      setLeakData(null)
    } finally {
      setLeakLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadBlacklist()
  }, [loadBlacklist])

  useEffect(() => {
    loadLeakDashboard()
  }, [loadLeakDashboard])

  const handleAddWallet = async () => {
    if (!newWallet.address) {
      toast({ title: t('adminSecurity_toastWalletRequired'), variant: 'destructive' })
      return
    }

    try {
      const res = await fetch('/api/admin/blacklist/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newWallet),
      })

      if (res.ok) {
        toast({ title: t('adminSecurity_toastWalletOk') })
        setShowWalletModal(false)
        setNewWallet({ address: '', reason: '' })
        loadBlacklist()
      }
    } catch (error) {
      toast({ title: t('adminSecurity_toastError'), variant: 'destructive' })
    }
  }

  const handleAddPhone = async () => {
    if (!newPhone.number) {
      toast({ title: t('adminSecurity_toastPhoneRequired'), variant: 'destructive' })
      return
    }

    try {
      const res = await fetch('/api/admin/blacklist/phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newPhone),
      })

      if (res.ok) {
        toast({ title: t('adminSecurity_toastPhoneOk') })
        setShowPhoneModal(false)
        setNewPhone({ number: '', reason: '' })
        loadBlacklist()
      }
    } catch (error) {
      toast({ title: t('adminSecurity_toastError'), variant: 'destructive' })
    }
  }

  const handleRemoveEntry = async (id) => {
    if (!id) return
    try {
      const res = await fetch(`/api/admin/blacklist/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.ok) {
        toast({ title: t('adminSecurity_toastRemoved') })
        await loadBlacklist()
      } else {
        const json = await res.json().catch(() => ({}))
        toast({
          title: t('adminSecurity_toastError'),
          description: json.error || String(res.status),
          variant: 'destructive',
        })
      }
    } catch {
      toast({ title: t('adminSecurity_toastError'), variant: 'destructive' })
    }
  }

  const modeHint = (mode) => {
    const m = String(mode || 'ADVISORY').toUpperCase()
    if (m === 'REDACT') return t('adminSafety_modeHint_REDACT')
    if (m === 'BLOCK') return t('adminSafety_modeHint_BLOCK')
    return t('adminSafety_modeHint_ADVISORY')
  }

  const banUser = async (userId) => {
    if (!userId) return
    if (!window.confirm(t('adminSecurity_banUser') + '?')) return
    try {
      const res = await fetch('/api/v2/admin/users/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast({
          title: t('adminSecurity_toastError'),
          description: json.error || String(res.status),
          variant: 'destructive',
        })
        return
      }
      toast({ title: t('adminSecurity_banOk') })
      await loadLeakDashboard()
    } catch {
      toast({ title: t('adminSecurity_toastError'), variant: 'destructive' })
    }
  }

  const patchUserStrikes = async (userId, body) => {
    try {
      const res = await fetch(`/api/v2/admin/users/${encodeURIComponent(userId)}/contact-strikes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        toast({
          title: t('adminSecurity_toastError'),
          description: json.error || String(res.status),
          variant: 'destructive',
        })
        return
      }
      toast({ title: t('adminSecurity_strikeUpdated') })
      await loadLeakDashboard()
    } catch {
      toast({ title: t('adminSecurity_toastError'), variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-red-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl lg:text-3xl">{t('adminSecurity_title')}</h1>
        <p className="mt-1 text-sm text-gray-600 sm:text-base">{t('adminSecurity_subtitle')}</p>
      </div>

      <Tabs defaultValue="blacklist" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="blacklist">{t('adminSecurity_tabBlacklist')}</TabsTrigger>
          <TabsTrigger value="leaks" className="gap-1.5">
            <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
            {t('adminSecurity_tabLeaks')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blacklist" className="mt-4 space-y-4 sm:space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            <Card className="border-2 border-red-100 bg-red-50">
              <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
                <CardTitle className="text-xs text-gray-600 sm:text-sm">{t('adminSecurity_statWallets')}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4">
                <div className="text-2xl font-bold text-red-600 sm:text-3xl">{blacklist.wallets.length}</div>
              </CardContent>
            </Card>
            <Card className="border-2 border-orange-100 bg-orange-50">
              <CardHeader className="p-3 pb-1 sm:p-4 sm:pb-2">
                <CardTitle className="text-xs text-gray-600 sm:text-sm">{t('adminSecurity_statPhones')}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-4">
                <div className="text-2xl font-bold text-orange-600 sm:text-3xl">{blacklist.phones.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-2 border-red-200 shadow-xl">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Shield className="h-5 w-5 shrink-0 text-red-600 sm:h-6 sm:w-6" />
                    {t('adminSecurity_walletsTitle')}
                  </CardTitle>
                  <CardDescription className="text-sm">{t('adminSecurity_walletsDesc')}</CardDescription>
                </div>
                <Button
                  onClick={() => setShowWalletModal(true)}
                  variant="destructive"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('adminSecurity_add')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6">
              {blacklist.wallets.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500 sm:py-8">{t('adminSecurity_noWallets')}</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {blacklist.wallets.map((wallet) => (
                    <div
                      key={wallet.id || wallet.address}
                      className="flex items-start justify-between gap-2 rounded-lg border-2 border-red-200 bg-red-50 p-3 sm:p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs font-bold text-gray-900 sm:text-sm">{wallet.address}</p>
                        <p className="mt-1 truncate text-xs text-red-700 sm:text-sm">⚠️ {wallet.reason}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(wallet.addedAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'th' ? 'th-TH' : 'en-US')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-shrink-0"
                        disabled={!wallet.id}
                        onClick={() => void handleRemoveEntry(wallet.id)}
                        aria-label={t('adminSecurity_remove')}
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-2 border-orange-200 shadow-xl">
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-orange-600 sm:h-6 sm:w-6" />
                    {t('adminSecurity_phonesTitle')}
                  </CardTitle>
                  <CardDescription className="text-sm">{t('adminSecurity_phonesDesc')}</CardDescription>
                </div>
                <Button
                  onClick={() => setShowPhoneModal(true)}
                  className="w-full bg-orange-600 hover:bg-orange-700 sm:w-auto"
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('adminSecurity_add')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6">
              {blacklist.phones.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500 sm:py-8">{t('adminSecurity_noPhones')}</p>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {blacklist.phones.map((phone) => (
                    <div
                      key={phone.id || phone.number}
                      className="flex items-start justify-between gap-2 rounded-lg border-2 border-orange-200 bg-orange-50 p-3 sm:p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-base font-semibold text-gray-900 sm:text-lg">{phone.number}</p>
                        <p className="mt-1 truncate text-xs text-orange-700 sm:text-sm">⚠️ {phone.reason}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(phone.addedAt).toLocaleDateString(language === 'ru' ? 'ru-RU' : language === 'th' ? 'th-TH' : 'en-US')}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-shrink-0"
                        disabled={!phone.id}
                        onClick={() => void handleRemoveEntry(phone.id)}
                        aria-label={t('adminSecurity_remove')}
                      >
                        <Trash2 className="h-4 w-4 text-orange-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaks" className="mt-4 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">{t('adminSecurity_leakIntro')}</p>
            <Button variant="outline" size="sm" onClick={loadLeakDashboard} disabled={leakLoading} className="shrink-0">
              <RefreshCw className={`mr-2 h-4 w-4 ${leakLoading ? 'animate-spin' : ''}`} aria-hidden />
              {t('adminSecurity_refresh')}
            </Button>
          </div>

          {leakError && (
            <p className="text-sm text-red-600">{t('adminSecurity_leakError')}</p>
          )}

          {leakLoading && !leakData && <p className="text-sm text-gray-500">{t('adminSecurity_loading')}</p>}

          {leakData && (
            <>
              <Card className="border border-sky-200 bg-sky-50/80">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('adminSafety_modeLabel')}</CardTitle>
                  <CardDescription className="font-mono text-sm">{String(leakData.contactSafetyMode || 'ADVISORY')}</CardDescription>
                  <p className="text-xs leading-relaxed text-slate-700">{modeHint(leakData.contactSafetyMode)}</p>
                </CardHeader>
              </Card>

              {leakData.chatSafetySettings && (
                <Card className="border border-emerald-200 bg-emerald-50/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Настройки из «Глобальные настройки»</CardTitle>
                    <CardDescription className="text-xs text-slate-700">
                      Auto-shadowban:{' '}
                      <strong>{leakData.chatSafetySettings.autoShadowbanEnabled ? 'ON' : 'OFF'}</strong>
                      {' · '}
                      Порог страйков: <strong>{leakData.chatSafetySettings.strikeThreshold}</strong>
                      {' · '}
                      Понижение в поиске:{' '}
                      <strong>
                        {leakData.chatSafetySettings.searchRankPenaltyEnabled !== false ? 'ON' : 'OFF'}
                      </strong>
                      {' · '}
                      Средний чек (THB): <strong>{leakData.chatSafetySettings.estimatedBookingValueThb}</strong>
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { key: 'day', label: t('adminSecurity_periodDay'), period: leakData.periods?.day },
                  { key: 'week', label: t('adminSecurity_periodWeek'), period: leakData.periods?.week },
                  { key: 'month', label: t('adminSecurity_periodMonth'), period: leakData.periods?.month },
                ].map(({ key, label, period }) => {
                  const lossThb = leakData.estimation?.potentialCommissionLossThb?.[key]
                  const lossDisp = leakData.estimation?.potentialCommissionLossDisplay?.[key] || {}
                  const fmtLoss = (v) =>
                    v == null || !Number.isFinite(Number(v))
                      ? '—'
                      : Number(v).toLocaleString(language === 'ru' ? 'ru-RU' : language === 'th' ? 'th-TH' : 'en-US', {
                          maximumFractionDigits: 0,
                        })
                  return (
                    <Card key={key} className="border-2 border-slate-200">
                      <CardHeader className="p-3 pb-1 sm:p-4">
                        <CardTitle className="text-xs text-gray-600 sm:text-sm">{label}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 p-3 pt-0 sm:p-4">
                        <div>
                          <div className="text-2xl font-bold text-slate-900 sm:text-3xl">{period?.count ?? 0}</div>
                          <div className="text-xs text-gray-500">{t('adminSecurity_attemptsLabel')}</div>
                        </div>
                        <div className="border-t border-slate-100 pt-2 space-y-1">
                          <div className="text-xs text-gray-500">{t('adminSecurity_potentialLoss')}</div>
                          <div className="text-sm font-semibold text-amber-800">฿{fmtLoss(lossThb)}</div>
                          <div className="text-xs text-slate-600">
                            USD {fmtLoss(lossDisp.USD)} · RUB {fmtLoss(lossDisp.RUB)}
                          </div>
                          <p className="text-[10px] leading-snug text-gray-400">
                            {leakData.estimation?.baseCurrency === 'THB'
                              ? 'Курсы: exchange_rates, без витринной надбавки (getDisplayRateMap retail off).'
                              : ''}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              <p className="text-xs leading-relaxed text-gray-500">{t('adminSecurity_potentialLossHint')}</p>

              {leakData.summary ? (
                <div className="grid gap-2 sm:grid-cols-3 text-sm">
                  <Card className="border-slate-200">
                    <CardContent className="p-3">
                      <p className="text-xs text-slate-500">Со страйками</p>
                      <p className="text-2xl font-bold tabular-nums">{leakData.summary.profilesWithStrikes ?? 0}</p>
                    </CardContent>
                  </Card>
                  <Card className="border-red-200 bg-red-50/50">
                    <CardContent className="p-3">
                      <p className="text-xs text-slate-500">Активные (≥ порога)</p>
                      <p className="text-2xl font-bold tabular-nums text-red-800">
                        {leakData.summary.activeViolators ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="border-amber-200 bg-amber-50/50">
                    <CardContent className="p-3">
                      <p className="text-xs text-slate-500">Попыток за 7 дней</p>
                      <p className="text-2xl font-bold tabular-nums text-amber-900">
                        {leakData.summary.weekAttempts ?? 0}
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : null}

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('adminSecurity_topViolators')}</CardTitle>
                  <CardDescription className="text-xs text-slate-600">
                    Страйки в профиле, последние срабатывания детектора, объявления партнёра
                  </CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {!leakData.topViolators?.length ? (
                    <p className="py-6 text-center text-sm text-gray-500">{t('adminSecurity_noViolators')}</p>
                  ) : (
                    <table className="w-full min-w-[880px] text-left text-sm">
                      <thead>
                        <tr className="border-b text-xs uppercase tracking-wide text-gray-500">
                          <th className="pb-2 pr-3 font-medium">{t('adminSecurity_colUser')}</th>
                          <th className="pb-2 pr-3 font-medium w-24">{t('adminSecurity_colStrikes')}</th>
                          <th className="pb-2 pr-3 font-medium min-w-[200px]">{t('adminSecurity_colRecent')}</th>
                          <th className="pb-2 pr-3 font-medium min-w-[180px]">{t('adminSecurity_colListings')}</th>
                          <th className="pb-2 font-medium min-w-[200px]">{t('adminSecurity_colActions')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leakData.topViolators.map((row) => (
                          <tr key={row.userId} className="border-b border-gray-100">
                            <td className="max-w-[200px] py-2 pr-2 align-top break-words">
                              <div className="font-medium text-gray-900">{row.displayName || t('adminSecurity_unknownUser')}</div>
                              {row.email && <div className="text-xs text-gray-500">{row.email}</div>}
                              {row.isBanned ? (
                                <span className="mt-1 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-900">
                                  {t('adminSecurity_bannedBadge')}
                                </span>
                              ) : null}
                              {row.searchPenalized ? (
                                <span className="mt-1 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                                  {t('adminSecurity_searchPenalized')}
                                </span>
                              ) : null}
                              <Link
                                href={`/admin/users/${encodeURIComponent(row.userId)}`}
                                className="mt-1 inline-flex items-center gap-1 text-xs text-sky-700 underline"
                              >
                                <ExternalLink className="h-3 w-3" aria-hidden />
                                {t('adminSecurity_openProfile')}
                              </Link>
                            </td>
                            <td className="py-3 pr-3 align-top">
                              <span className="inline-flex min-w-[2.5rem] justify-center rounded-lg bg-slate-100 px-2 py-1 text-lg font-bold tabular-nums text-slate-900">
                                {row.strikes != null ? row.strikes : '—'}
                              </span>
                              {row.attemptCount > 0 ? (
                                <p className="mt-1 text-[10px] text-gray-500">
                                  {row.attemptCount} {t('adminSecurity_attemptsLabel')} (90д)
                                </p>
                              ) : null}
                            </td>
                            <td className="max-w-[200px] py-2 pr-2 align-top text-xs">
                              {row.recentEvents?.length ? (
                                <ul className="space-y-1">
                                  {row.recentEvents.map((ev) => (
                                    <li key={ev.id}>
                                      <span className="text-gray-500">
                                        {ev.at
                                          ? new Date(ev.at).toLocaleString(
                                              language === 'ru' ? 'ru-RU' : 'en-US',
                                              { dateStyle: 'short', timeStyle: 'short' },
                                            )
                                          : '—'}
                                      </span>
                                      {ev.conversationId ? (
                                        <>
                                          {' · '}
                                          <Link
                                            href={`/messages/${encodeURIComponent(ev.conversationId)}`}
                                            className="text-sky-700 underline"
                                          >
                                            {t('adminSecurity_openChat')}
                                          </Link>
                                        </>
                                      ) : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="max-w-[240px] py-3 pr-3 align-top text-xs">
                              {row.listings?.length ? (
                                <ul className="space-y-1.5">
                                  {row.listings.slice(0, 5).map((l) => (
                                    <li key={l.id}>
                                      <Link
                                        href={`/listings/${encodeURIComponent(l.id)}`}
                                        className="font-medium text-sky-700 underline break-words"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        {l.title || l.id}
                                      </Link>
                                      <span className="ml-1 text-gray-400">({l.status})</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-gray-400">Нет объявлений</span>
                              )}
                            </td>
                            <td className="py-3 align-top">
                              <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-9 text-xs font-semibold"
                                  onClick={() => void patchUserStrikes(row.userId, { action: 'increment', delta: 1 })}
                                >
                                  {t('adminSecurity_strikeAdd')}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  className="h-9 text-xs"
                                  onClick={() => void patchUserStrikes(row.userId, { action: 'reset' })}
                                >
                                  {t('adminSecurity_strikeResetAll')}
                                </Button>
                                {!row.isBanned ? (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="destructive"
                                    className="h-9 text-xs font-semibold"
                                    onClick={() => void banUser(row.userId)}
                                  >
                                    {t('adminSecurity_banUser')}
                                  </Button>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={showWalletModal} onOpenChange={setShowWalletModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminSecurity_walletModalTitle')}</DialogTitle>
            <DialogDescription>{t('adminSecurity_walletModalDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{t('adminSecurity_labelAddress')}</Label>
              <Input
                placeholder={t('adminSecurity_placeholderWallet')}
                value={newWallet.address}
                onChange={(e) => setNewWallet({ ...newWallet, address: e.target.value })}
                className="mt-2 font-mono"
              />
            </div>
            <div>
              <Label>{t('adminSecurity_labelReason')}</Label>
              <Textarea
                placeholder={t('adminSecurity_placeholderReasonWallet')}
                value={newWallet.reason}
                onChange={(e) => setNewWallet({ ...newWallet, reason: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWalletModal(false)}>{t('adminSecurity_cancel')}</Button>
            <Button onClick={handleAddWallet} variant="destructive">{t('adminSecurity_blockWallet')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPhoneModal} onOpenChange={setShowPhoneModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('adminSecurity_phoneModalTitle')}</DialogTitle>
            <DialogDescription>{t('adminSecurity_phoneModalDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>{t('adminSecurity_labelPhone')}</Label>
              <Input
                placeholder={t('adminSecurity_placeholderPhone')}
                value={newPhone.number}
                onChange={(e) => setNewPhone({ ...newPhone, number: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>{t('adminSecurity_labelReason')}</Label>
              <Textarea
                placeholder={t('adminSecurity_placeholderReasonPhone')}
                value={newPhone.reason}
                onChange={(e) => setNewPhone({ ...newPhone, reason: e.target.value })}
                className="mt-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPhoneModal(false)}>{t('adminSecurity_cancel')}</Button>
            <Button onClick={handleAddPhone} className="bg-orange-600 hover:bg-orange-700">{t('adminSecurity_blockPhone')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
