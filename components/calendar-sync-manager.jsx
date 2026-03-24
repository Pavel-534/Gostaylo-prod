'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Link2, Plus, Trash2, RefreshCw, CheckCircle2, XCircle,
  AlertCircle, Calendar, Clock, Loader2, Copy, Share2, BookOpen
} from 'lucide-react'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'

const PLATFORMS = [
  { value: 'Airbnb', label: 'Airbnb', color: 'bg-red-100 text-red-700 border-red-200' },
  { value: 'Booking.com', label: 'Booking.com', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'VRBO', label: 'VRBO', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'Google Calendar', label: 'Google Calendar', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'Custom', label: 'Custom', color: 'bg-slate-100 text-slate-700 border-slate-200' },
]

function detectPlatform(url) {
  if (!url) return 'Custom'
  const lowerUrl = url.toLowerCase()
  if (lowerUrl.includes('airbnb')) return 'Airbnb'
  if (lowerUrl.includes('booking.com')) return 'Booking.com'
  if (lowerUrl.includes('vrbo') || lowerUrl.includes('homeaway')) return 'VRBO'
  if (lowerUrl.includes('google.com') || lowerUrl.includes('calendar.google')) return 'Google Calendar'
  return 'Custom'
}

function getPlatformBadge(platform) {
  const config = PLATFORMS.find(p => p.value === platform) || PLATFORMS[4]
  return <Badge className={`${config.color} border`}>{config.label}</Badge>
}

export default function CalendarSyncManager({ listingId, onSync }) {
  const { language } = useI18n()
  const tr = (k) => getUIText(k, language)

  const [syncSettings, setSyncSettings] = useState({
    sources: [],
    auto_sync: false,
    sync_interval_hours: 24,
    last_sync: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncingSourceId, setSyncingSourceId] = useState(null)
  const [blockedDates, setBlockedDates] = useState([])
  const [exportUrl, setExportUrl] = useState('')
  const [exportLoading, setExportLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const [newUrl, setNewUrl] = useState('')
  const [newPlatform, setNewPlatform] = useState('')
  const [addingSource, setAddingSource] = useState(false)

  useEffect(() => {
    if (listingId) {
      loadSyncSettings()
      loadBlockedDates()
      loadExportLink()
    }
  }, [listingId])

  async function loadExportLink() {
    setExportLoading(true)
    setExportUrl('')
    try {
      const res = await fetch(`/api/v2/partner/listings/${listingId}/ical-export-link`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data?.exportUrl) {
        setExportUrl(json.data.exportUrl)
      }
    } catch (e) {
      console.error('Failed to load iCal export link:', e)
    } finally {
      setExportLoading(false)
    }
  }

  async function copyExportUrl() {
    if (!exportUrl) return
    try {
      await navigator.clipboard.writeText(exportUrl)
      setCopied(true)
      toast.success(language === 'ru' ? 'Ссылка скопирована' : 'Link copied')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      toast.error(language === 'ru' ? 'Не удалось скопировать' : 'Copy failed')
    }
  }

  async function loadSyncSettings() {
    try {
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, { credentials: 'include' })
      const json = await res.json()
      const listing = json?.success ? (json.data || json.listing) : null

      if (listing) {
        let settings = listing.sync_settings || {}
        if ((!settings.sources || settings.sources.length === 0) && listing.metadata?.sync_settings) {
          settings = {
            sources: listing.metadata.sync_settings,
            auto_sync: listing.metadata.auto_sync || false,
            sync_interval_hours: listing.metadata.sync_interval_hours || 24,
            last_sync: listing.metadata.last_ical_sync,
          }
        }
        setSyncSettings({
          sources: settings.sources || [],
          auto_sync: settings.auto_sync || false,
          sync_interval_hours: settings.sync_interval_hours || 24,
          last_sync: settings.last_sync || null,
        })
      }
      setLoading(false)
    } catch (error) {
      console.error('Failed to load sync settings:', error)
      setLoading(false)
    }
  }

  async function loadBlockedDates() {
    try {
      const res = await fetch(`/api/v2/partner/listings/${listingId}/calendar`, { credentials: 'include' })
      const json = await res.json()
      if (!json.success || !json.blocks) {
        setBlockedDates([])
        return
      }
      const icalBlocks = (json.blocks || []).filter(b => b.source && b.source !== 'manual')
      setBlockedDates(
        icalBlocks.map(b => ({
          id: b.id,
          check_in: b.start_date,
          check_out: b.end_date,
          guest_name: b.reason || '',
        }))
      )
    } catch (error) {
      console.error('Failed to load blocked dates:', error)
      setBlockedDates([])
    }
  }

  async function saveSyncSettings(newSettings, { silent = false } = {}) {
    setSaving(true)
    try {
      const res = await fetch(`/api/v2/partner/listings/${listingId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sync_settings: newSettings }),
      })

      if (res.ok) {
        setSyncSettings(newSettings)
        if (!silent) toast.success(language === 'ru' ? 'Сохранено' : 'Saved')
      } else {
        toast.error(language === 'ru' ? 'Ошибка сохранения' : 'Save failed')
      }
    } catch (error) {
      console.error('Failed to save sync settings:', error)
      toast.error(language === 'ru' ? 'Ошибка сохранения' : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddSource() {
    if (!newUrl.trim()) {
      toast.error(language === 'ru' ? 'Введите URL' : 'Enter URL')
      return
    }
    if (!newUrl.startsWith('http')) {
      toast.error(language === 'ru' ? 'URL должен начинаться с http(s)://' : 'URL must start with http(s)://')
      return
    }
    if (syncSettings.sources.some(s => s.url === newUrl)) {
      toast.error(language === 'ru' ? 'Этот URL уже добавлен' : 'This URL is already added')
      return
    }

    setAddingSource(true)
    try {
      const testRes = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse', url: newUrl }),
      })
      const testData = await testRes.json()

      if (!testData.success) {
        toast.error(testData.error || (language === 'ru' ? 'Не удалось загрузить календарь' : 'Could not load calendar'))
        setAddingSource(false)
        return
      }

      const platform = newPlatform || detectPlatform(newUrl)
      const newSource = {
        id: `src-${Date.now().toString(36)}`,
        url: newUrl,
        platform,
        enabled: true,
        added_at: new Date().toISOString(),
        status: 'active',
        last_sync: null,
        events_count: testData.futureEvents || 0,
      }

      const newSettings = {
        ...syncSettings,
        sources: [...syncSettings.sources, newSource],
      }

      await saveSyncSettings(newSettings, { silent: true })
      toast.success(
        language === 'ru'
          ? `Добавлено: ${platform} (${testData.futureEvents || 0} событий)`
          : `Added: ${platform} (${testData.futureEvents || 0} events)`
      )
      setNewUrl('')
      setNewPlatform('')
    } catch (error) {
      console.error('Failed to add source:', error)
      toast.error(language === 'ru' ? 'Ошибка' : 'Error')
    } finally {
      setAddingSource(false)
    }
  }

  async function handleRemoveSource(sourceId) {
    const newSettings = {
      ...syncSettings,
      sources: syncSettings.sources.filter(s => s.id !== sourceId),
    }
    await saveSyncSettings(newSettings)
    toast.success(language === 'ru' ? 'Удалено' : 'Removed')
  }

  async function handleToggleAutoSync(checked) {
    await saveSyncSettings({ ...syncSettings, auto_sync: checked })
  }

  async function handleSyncSource(source) {
    setSyncingSourceId(source.id)
    try {
      const res = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          listingId,
          sources: [source],
        }),
      })
      const data = await res.json()

      if (data.success) {
        const newSettings = {
          ...syncSettings,
          sources: syncSettings.sources.map(s =>
            s.id === source.id
              ? {
                  ...s,
                  last_sync: new Date().toISOString(),
                  status: 'active',
                  events_count: data.eventsProcessed || 0,
                }
              : s
          ),
          last_sync: new Date().toISOString(),
        }
        await saveSyncSettings(newSettings, { silent: true })
        loadBlockedDates()
        toast.success(
          language === 'ru'
            ? `Синхронизировано: ${data.eventsProcessed || 0}`
            : `Synced: ${data.eventsProcessed || 0}`
        )
        onSync?.()
      } else {
        toast.error(data.error || 'Sync error')
      }
    } catch (error) {
      console.error('Sync error:', error)
      toast.error(language === 'ru' ? 'Ошибка синхронизации' : 'Sync failed')
    } finally {
      setSyncingSourceId(null)
    }
  }

  async function handleSyncAll() {
    if (syncSettings.sources.length === 0) {
      toast.error(language === 'ru' ? 'Нет источников' : 'No sources')
      return
    }
    setSyncing(true)
    try {
      const res = await fetch('/api/ical/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync',
          listingId,
          sources: syncSettings.sources.filter(s => s.enabled),
        }),
      })
      const data = await res.json()

      if (data.success) {
        await saveSyncSettings({ ...syncSettings, last_sync: new Date().toISOString() }, { silent: true })
        loadBlockedDates()
        toast.success(
          language === 'ru'
            ? `Готово: ${data.eventsProcessed || 0} событий`
            : `Done: ${data.eventsProcessed || 0} events`
        )
        onSync?.()
      } else {
        toast.error(data.error || 'Sync error')
      }
    } catch (error) {
      console.error('Sync all error:', error)
      toast.error(language === 'ru' ? 'Ошибка' : 'Error')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <Card className="border-2 border-teal-100 shadow-sm">
        <CardContent className="p-10 flex items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-teal-600" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card id="partner-calendar-sync" className="border-2 border-teal-100 shadow-md scroll-mt-24 overflow-hidden">
      <CardHeader className="pb-2 bg-gradient-to-r from-teal-50/80 to-white border-b border-teal-100">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-600 flex items-center justify-center shrink-0 shadow-sm">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl text-slate-900">{tr('partnerCal_mainTitle')}</CardTitle>
              <CardDescription className="text-sm mt-1">{tr('partnerCal_mainSubtitle')}</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 sm:p-0">
        <Tabs defaultValue="export" className="w-full">
          <div className="px-4 pt-4 sm:px-6">
            <TabsList className="flex w-full flex-col gap-1.5 h-auto p-1.5 bg-slate-100/90 rounded-xl sm:grid sm:grid-cols-2 sm:gap-0">
              <TabsTrigger
                value="export"
                className="rounded-lg py-2.5 px-2 text-xs sm:text-sm leading-snug whitespace-normal data-[state=active]:shadow-sm gap-2 justify-center text-center min-h-[2.75rem] sm:min-h-0"
              >
                <Share2 className="h-4 w-4 shrink-0" />
                {tr('partnerCal_tabExport')}
              </TabsTrigger>
              <TabsTrigger
                value="import"
                className="rounded-lg py-2.5 px-2 text-xs sm:text-sm leading-snug whitespace-normal data-[state=active]:shadow-sm gap-2 justify-center text-center min-h-[2.75rem] sm:min-h-0"
              >
                <Link2 className="h-4 w-4 shrink-0" />
                {tr('partnerCal_tabImport')}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="export" className="mt-0 px-4 pb-4 sm:px-6 sm:pb-6 pt-4 space-y-4">
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <Share2 className="h-5 w-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">{tr('partnerCal_exportTitle')}</p>
                  <p className="text-sm text-slate-600 mt-1 leading-relaxed">{tr('partnerCal_exportLead')}</p>
                </div>
              </div>

              {exportLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {tr('partnerCal_loadingUrl')}
                </div>
              ) : exportUrl ? (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    readOnly
                    value={exportUrl}
                    className="font-mono text-xs bg-white flex-1"
                    onClick={e => e.target.select()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-teal-400 text-teal-900 hover:bg-teal-100 shrink-0"
                    onClick={copyExportUrl}
                  >
                    {copied ? <CheckCircle2 className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                    {copied ? tr('partnerCal_copied') : tr('partnerCal_copy')}
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  {tr('partnerCal_urlError')}
                </p>
              )}

              <Accordion type="single" collapsible className="border border-teal-100 rounded-lg bg-white/80 px-3">
                <AccordionItem value="help" className="border-0">
                  <AccordionTrigger className="text-sm font-medium text-teal-900 hover:no-underline py-3">
                    <span className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {tr('partnerCal_accordionTitle')}
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-slate-600 space-y-2 pb-3">
                    <p>• {tr('partnerCal_accordion1')}</p>
                    <p>• {tr('partnerCal_accordion2')}</p>
                    <p>• {tr('partnerCal_accordion3')}</p>
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                      <p className="text-xs font-medium text-slate-700">{language === 'ru' ? 'Куда вставить' : 'Where to paste'}</p>
                      <p className="text-xs">{tr('partnerCal_whereAirbnb')}</p>
                      <p className="text-xs">{tr('partnerCal_whereBooking')}</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </TabsContent>

          <TabsContent value="import" className="mt-0 px-4 pb-4 sm:px-6 sm:pb-6 pt-4 space-y-4">
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
              <p className="font-medium text-slate-900">{tr('partnerCal_importTitle')}</p>
              <p className="text-sm text-slate-600 mt-1">{tr('partnerCal_importLead')}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <Input
                    placeholder={tr('partnerCal_addPlaceholder')}
                    value={newUrl}
                    onChange={e => setNewUrl(e.target.value)}
                    className="w-full"
                  />
                </div>
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder={tr('partnerCal_platformLabel')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleAddSource}
                  disabled={addingSource || !newUrl.trim()}
                  className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
                >
                  {addingSource ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  {tr('partnerCal_add')}
                </Button>
              </div>
              <p className="text-xs text-slate-500">{tr('partnerCal_findIcal')}</p>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Label htmlFor="auto-sync" className="text-sm text-slate-700">
                  {tr('partnerCal_autoSync')}
                </Label>
                <Switch
                  id="auto-sync"
                  checked={syncSettings.auto_sync}
                  onCheckedChange={handleToggleAutoSync}
                  disabled={saving}
                />
              </div>
              {syncSettings.sources.length > 0 && (
                <Button
                  onClick={handleSyncAll}
                  disabled={syncing}
                  variant="outline"
                  size="sm"
                  className="border-indigo-300 text-indigo-700"
                >
                  {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  {tr('partnerCal_syncAll')}
                </Button>
              )}
            </div>

            {syncSettings.sources.length > 0 ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-800">
                  {tr('partnerCal_connected')} ({syncSettings.sources.length})
                </Label>
                {syncSettings.sources.map(source => (
                  <div
                    key={source.id}
                    className="bg-white rounded-lg p-3 border border-slate-200 flex items-center gap-3 shadow-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {getPlatformBadge(source.platform)}
                        {source.status === 'active' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {source.status === 'error' && <XCircle className="h-4 w-4 text-red-500" />}
                      </div>
                      <p className="text-xs text-slate-500 truncate" title={source.url}>
                        {source.url}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        {source.last_sync && (
                          <span className="text-xs text-slate-400 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(source.last_sync).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                          </span>
                        )}
                        {source.events_count > 0 && (
                          <span className="text-xs text-slate-400">{source.events_count}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSyncSource(source)}
                        disabled={syncingSourceId === source.id}
                        className="h-8 w-8 text-indigo-600"
                      >
                        {syncingSourceId === source.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSource(source.id)}
                        className="h-8 w-8 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center">
                <Link2 className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p className="text-sm font-medium text-slate-700">{tr('partnerCal_emptyImport')}</p>
                <p className="text-xs text-slate-500 mt-1">{tr('partnerCal_emptyImportHint')}</p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {(blockedDates.length > 0 || syncSettings.last_sync) && (
          <div className="px-4 pb-6 sm:px-6 border-t border-slate-100 bg-slate-50/50 space-y-3 pt-4">
            {blockedDates.length > 0 && (
              <div className="rounded-lg p-3 border border-amber-200 bg-amber-50/90">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-amber-700" />
                  <span className="text-sm font-medium text-amber-900">
                    {tr('partnerCal_blocked')}: {blockedDates.length}
                  </span>
                </div>
                <div className="space-y-1">
                  {blockedDates.slice(0, 5).map(block => (
                    <p key={block.id} className="text-xs text-amber-900/90">
                      {new Date(block.check_in).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')} —{' '}
                      {new Date(block.check_out).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-US')}
                      {block.guest_name && ` (${block.guest_name})`}
                    </p>
                  ))}
                  {blockedDates.length > 5 && (
                    <p className="text-xs text-amber-800">+{blockedDates.length - 5}</p>
                  )}
                </div>
              </div>
            )}
            {syncSettings.last_sync && (
              <p className="text-xs text-slate-500 text-center">
                {tr('partnerCal_lastSync')}:{' '}
                {new Date(syncSettings.last_sync).toLocaleString(language === 'ru' ? 'ru-RU' : 'en-US')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
