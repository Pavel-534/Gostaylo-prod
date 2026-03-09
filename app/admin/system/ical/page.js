'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Loader2, RefreshCw, AlertCircle, CheckCircle, 
  Calendar, ArrowLeft, Filter, Clock, ExternalLink,
  Activity, Play, List
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AdminICalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ total_24h: 0, success_24h: 0, errors_24h: 0 })
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [listings, setListings] = useState([])
  const [user, setUser] = useState(null)
  const [lastSyncResult, setLastSyncResult] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('gostaylo_user')
    if (stored) {
      const parsed = JSON.parse(stored)
      setUser(parsed)
      if (parsed.role !== 'ADMIN') {
        router.push('/')
      } else {
        loadData()
      }
    } else {
      router.push('/')
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      loadLogs()
    }
  }, [errorsOnly, user])

  const loadData = useCallback(async () => {
    await Promise.all([loadLogs(), loadListings()])
    setLoading(false)
  }, [])

  async function loadLogs() {
    try {
      const url = `/api/v2/admin/ical?limit=50${errorsOnly ? '&errors_only=true' : ''}`
      const res = await fetch(url, { credentials: 'include' })
      const result = await res.json()
      
      if (result.success) {
        setLogs(result.logs || [])
        setStats(result.stats || { total_24h: 0, success_24h: 0, errors_24h: 0 })
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    }
  }

  async function loadListings() {
    try {
      const res = await fetch('/api/v2/admin/ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'get_sync_enabled' })
      })
      const result = await res.json()
      
      if (result.success) {
        setListings(result.listings || [])
      }
    } catch (error) {
      console.error('Failed to load listings:', error)
    }
  }

  async function triggerSyncAll() {
    setSyncing(true)
    setLastSyncResult(null)
    
    try {
      const res = await fetch('/api/v2/admin/ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'sync_all' })
      })
      const result = await res.json()
      
      if (result.success) {
        setLastSyncResult(result)
        
        // Show appropriate toast based on results
        if (result.errors > 0) {
          toast.warning(`Синхронизация завершена: ${result.synced} успешно, ${result.errors} ошибок`)
        } else if (result.synced > 0) {
          toast.success(`Синхронизация завершена: ${result.synced} источников обработано`)
        } else {
          toast.info('Нет источников для синхронизации')
        }
        
        // Auto-refresh stats after sync
        await loadLogs()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast.error(error.message || 'Ошибка синхронизации')
    } finally {
      setSyncing(false)
    }
  }

  async function triggerSync(listingId) {
    try {
      const res = await fetch('/api/v2/admin/ical', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'sync', listingId })
      })
      const result = await res.json()
      
      if (result.success) {
        toast.success('Синхронизация запущена')
        // Auto-refresh after 2 seconds
        setTimeout(loadLogs, 2000)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      toast.error(error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin/system">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                iCal Синхронизация
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                История синхронизации и управление
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* Logs Page Button */}
              <Button 
                variant="outline" 
                size="sm"
                asChild
                title="Подробные логи"
              >
                <Link href="/admin/system/ical/logs">
                  <Activity className="h-4 w-4" />
                </Link>
              </Button>
              {/* Refresh Button */}
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => loadData()}
                title="Обновить"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-slate-900">{stats.total_24h}</p>
                <p className="text-xs text-slate-500">Всего за 24ч</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.success_24h}</p>
                <p className="text-xs text-slate-500">Успешно</p>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.errors_24h > 0 ? 'border-red-200' : ''}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{stats.errors_24h}</p>
                <p className="text-xs text-slate-500">Ошибок</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Last Sync Result */}
        {lastSyncResult && (
          <Card className={lastSyncResult.errors > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}>
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {lastSyncResult.errors > 0 ? (
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  <div>
                    <p className="font-medium text-slate-900">Последняя синхронизация</p>
                    <p className="text-sm text-slate-600">
                      Обработано: {lastSyncResult.synced}, Ошибок: {lastSyncResult.errors}, 
                      Пропущено: {lastSyncResult.skipped || 0}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  {lastSyncResult.duration}мс
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sync All Button */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Глобальная синхронизация</CardTitle>
                <CardDescription>
                  Синхронизировать все активные календари
                </CardDescription>
              </div>
              <Button 
                onClick={triggerSyncAll}
                disabled={syncing}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {syncing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Синхронизация...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Sync All
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Listings with Sync Enabled */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Объекты с синхронизацией</CardTitle>
            <CardDescription>
              Листинги с настроенными внешними календарями ({listings.length})
            </CardDescription>
          </CardHeader>
          <CardContent>
            {listings.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                Нет объектов с настроенной синхронизацией
              </p>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {listings.map(listing => (
                  <div 
                    key={listing.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{listing.title}</p>
                      <p className="text-xs text-slate-500">
                        {listing.sync_settings?.sources?.length || 0} источников
                        {listing.sync_settings?.last_sync && (
                          <span className="ml-2">
                            • Посл. синхр: {new Date(listing.sync_settings.last_sync).toLocaleDateString('ru-RU')}
                          </span>
                        )}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => triggerSync(listing.id)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Синхр.
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Logs Preview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Последние записи</CardTitle>
                <CardDescription>5 последних синхронизаций</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="errors-only"
                    checked={errorsOnly}
                    onCheckedChange={setErrorsOnly}
                  />
                  <Label htmlFor="errors-only" className="text-sm cursor-pointer">
                    Только ошибки
                  </Label>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/admin/system/ical/logs">
                    <List className="h-4 w-4 mr-1" />
                    Все логи
                  </Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                {errorsOnly ? 'Ошибок не найдено' : 'История пуста'}
              </p>
            ) : (
              <div className="space-y-2">
                {logs.slice(0, 5).map(log => (
                  <div 
                    key={log.id}
                    className={`p-3 rounded-lg ${
                      log.status === 'error' 
                        ? 'bg-red-50 border border-red-100' 
                        : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {log.status === 'error' ? (
                        <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={log.status === 'error' ? 'destructive' : 'default'} className="text-xs">
                            {log.status === 'error' ? 'Ошибка' : 'Успешно'}
                          </Badge>
                          {log.events_count > 0 && (
                            <span className="text-xs text-slate-500">
                              {log.events_count} событий
                            </span>
                          )}
                        </div>
                        {log.listing_title && (
                          <p className="text-sm font-medium text-slate-700 mt-1">
                            {log.listing_title}
                          </p>
                        )}
                        {log.error_message && (
                          <p className="text-xs text-red-600 mt-1">
                            {log.error_message}
                          </p>
                        )}
                        <p className="text-xs text-slate-400 mt-1">
                          <Clock className="h-3 w-3 inline mr-1" />
                          {new Date(log.synced_at).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
