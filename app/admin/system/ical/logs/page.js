'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { 
  Loader2, RefreshCw, AlertCircle, CheckCircle, 
  ArrowLeft, Filter, Clock, Search, Download
} from 'lucide-react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function ICalLogsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({ total_24h: 0, success_24h: 0, errors_24h: 0 })
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('gostaylo_user')
    if (stored) {
      const parsed = JSON.parse(stored)
      setUser(parsed)
      if (parsed.role !== 'ADMIN') {
        router.push('/')
      } else {
        loadLogs()
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

  async function loadLogs() {
    setLoading(true)
    try {
      const url = `/api/v2/admin/ical?limit=100${errorsOnly ? '&errors_only=true' : ''}`
      const res = await fetch(url, { credentials: 'include' })
      const result = await res.json()
      
      if (result.success) {
        setLogs(result.logs || [])
        setStats(result.stats || { total_24h: 0, success_24h: 0, errors_24h: 0 })
      }
    } catch (error) {
      console.error('Failed to load logs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Filter logs by search query
  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      log.listing_title?.toLowerCase().includes(query) ||
      log.source_url?.toLowerCase().includes(query) ||
      log.error_message?.toLowerCase().includes(query)
    )
  })

  function exportLogs() {
    const csv = [
      ['Timestamp', 'Listing', 'Status', 'Events', 'Source URL', 'Error'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.synced_at).toISOString(),
        `"${log.listing_title || log.listing_id || ''}"`,
        log.status,
        log.events_count || 0,
        `"${log.source_url || ''}"`,
        `"${log.error_message || ''}"`
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ical-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  if (loading && logs.length === 0) {
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
              <Link href="/admin/system/ical">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">
                Логи синхронизации
              </h1>
              <p className="text-xs sm:text-sm text-slate-500">
                Подробная история всех синхронизаций iCal
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportLogs}
                title="Экспорт CSV"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={loadLogs}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Поиск по названию, URL или ошибке..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="errors-only"
                    checked={errorsOnly}
                    onCheckedChange={setErrorsOnly}
                  />
                  <Label htmlFor="errors-only" className="text-sm cursor-pointer whitespace-nowrap">
                    <Filter className="h-4 w-4 inline mr-1" />
                    Только ошибки
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-slate-100">
            <CardContent className="py-3">
              <div className="text-center">
                <p className="text-xl font-bold text-slate-900">{stats.total_24h}</p>
                <p className="text-xs text-slate-500">Всего за 24ч</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-green-50">
            <CardContent className="py-3">
              <div className="text-center">
                <p className="text-xl font-bold text-green-600">{stats.success_24h}</p>
                <p className="text-xs text-slate-500">Успешно</p>
              </div>
            </CardContent>
          </Card>
          <Card className={stats.errors_24h > 0 ? 'bg-red-50' : 'bg-slate-100'}>
            <CardContent className="py-3">
              <div className="text-center">
                <p className="text-xl font-bold text-red-600">{stats.errors_24h}</p>
                <p className="text-xs text-slate-500">Ошибок</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              История ({filteredLogs.length} записей)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                {errorsOnly ? 'Ошибок не найдено' : 'Логи отсутствуют'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[160px]">Время</TableHead>
                      <TableHead>Объект</TableHead>
                      <TableHead className="w-[100px]">Статус</TableHead>
                      <TableHead className="w-[80px] text-center">События</TableHead>
                      <TableHead>Ошибка</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map(log => (
                      <TableRow 
                        key={log.id}
                        className={log.status === 'error' ? 'bg-red-50' : ''}
                      >
                        <TableCell className="font-mono text-xs text-slate-500">
                          {new Date(log.synced_at).toLocaleString('ru-RU', {
                            day: '2-digit',
                            month: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          })}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="font-medium text-sm truncate">
                              {log.listing_title || 'Неизвестный объект'}
                            </p>
                            <p className="text-xs text-slate-400 truncate" title={log.source_url}>
                              {log.source_url?.replace(/https?:\/\//, '').slice(0, 40)}...
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {log.status === 'error' ? (
                            <Badge variant="destructive" className="text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Ошибка
                            </Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-100 text-green-700 text-xs">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-medium ${log.events_count > 0 ? 'text-teal-600' : 'text-slate-400'}`}>
                            {log.events_count || 0}
                          </span>
                        </TableCell>
                        <TableCell>
                          {log.error_message ? (
                            <p className="text-xs text-red-600 max-w-[300px] truncate" title={log.error_message}>
                              {log.error_message}
                            </p>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
