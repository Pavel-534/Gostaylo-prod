'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Loader2, RefreshCw, AlertCircle, CheckCircle, 
  Calendar, ArrowLeft, Filter, Clock, ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function AdminICalPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ total_24h: 0, success_24h: 0, errors_24h: 0 })
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [listings, setListings] = useState([])
  const [user, setUser] = useState(null)

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

  async function loadData() {
    await Promise.all([loadLogs(), loadListings()])
    setLoading(false)
  }

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
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => loadData()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
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

        {/* Listings with Sync Enabled */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Объекты с синхронизацией</CardTitle>
            <CardDescription>
              Листинги с настроенными внешними календарями
            </CardDescription>
          </CardHeader>
          <CardContent>
            {listings.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                Нет объектов с настроенной синхронизацией
              </p>
            ) : (
              <div className="space-y-2">
                {listings.map(listing => (
                  <div 
                    key={listing.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{listing.title}</p>
                      <p className="text-xs text-slate-500">
                        {listing.sync_settings?.sources?.length || 0} источников
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

        {/* Sync Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">История синхронизации</CardTitle>
                <CardDescription>Последние 50 записей</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="errors-only"
                  checked={errorsOnly}
                  onCheckedChange={setErrorsOnly}
                />
                <Label htmlFor="errors-only" className="text-sm cursor-pointer">
                  <Filter className="h-4 w-4 inline mr-1" />
                  Только ошибки
                </Label>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">
                {errorsOnly ? 'Ошибок не найдено' : 'История пуста'}
              </p>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {logs.map(log => (
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
                        <p className="text-xs text-slate-500 mt-1 truncate" title={log.source_url}>
                          {log.source_url?.slice(0, 50)}...
                        </p>
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
