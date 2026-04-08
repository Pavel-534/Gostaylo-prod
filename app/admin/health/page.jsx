'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  AlertTriangle,
  CalendarSync,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
} from 'lucide-react'

function formatDt(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

function StatusBadge({ status }) {
  if (status === 'success') {
    return (
      <Badge className="rounded-lg bg-emerald-600 hover:bg-emerald-600 text-white border-0">Успешно</Badge>
    )
  }
  if (status === 'error') {
    return <Badge variant="destructive" className="rounded-lg">Ошибка</Badge>
  }
  if (status === 'running') {
    return (
      <Badge variant="secondary" className="rounded-lg bg-amber-100 text-amber-900 border-amber-200">
        В процессе
      </Badge>
    )
  }
  return <Badge variant="outline" className="rounded-lg">Нет данных</Badge>
}

export default function AdminHealthPage() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v2/admin/health', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setData(null)
        setError(json.error || `Ошибка ${res.status}`)
        return
      }
      if (!json.success) {
        setData(null)
        setError(json.error || 'Не удалось загрузить данные')
        return
      }
      setData(json)
    } catch (e) {
      setData(null)
      setError(e?.message || 'Сеть')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const ical = data?.jobs?.['ical-sync']
  const sweeper = data?.jobs?.['push-sweeper']
  const hygiene = data?.jobs?.['push-token-hygiene']
  const security = data?.security

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7 text-teal-600" />
            Здоровье системы
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Автономный мониторинг cron и сигналов безопасности за последние {data?.windowDays ?? 7} дн.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl shrink-0"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Обновить
        </Button>
      </div>

      {error ? (
        <Card className="rounded-2xl border-red-200 bg-red-50/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-red-800 text-base flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Доступ или загрузка
            </CardTitle>
            <CardDescription className="text-red-700">{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20 text-slate-500">
          <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
        </div>
      ) : null}

      {data?.meta?.opsError ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2">
          ops_job_runs: {data.meta.opsError}
        </p>
      ) : null}

      {data ? (
        <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-3">
          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarSync className="h-5 w-5 text-teal-600" />
                  Синхронизация iCal
                </CardTitle>
                <StatusBadge status={ical?.lastStatus} />
              </div>
              <CardDescription>Последний прогон и сумма за окно</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>
                <span className="text-slate-400">Запусков:</span>{' '}
                <span className="font-medium text-slate-800">{ical?.runCount ?? 0}</span>
                {' · '}
                <span className="text-emerald-600">OK {ical?.successRuns ?? 0}</span>
                {' / '}
                <span className="text-red-600">ошибок {ical?.errorRuns ?? 0}</span>
              </p>
              <p>
                <span className="text-slate-400">Успешных синхронизаций (сумма):</span>{' '}
                <span className="font-semibold text-slate-900">{ical?.totals?.synced ?? 0}</span>
              </p>
              <p>
                <span className="text-slate-400">Ошибок по источникам (сумма):</span>{' '}
                <span className="font-semibold text-slate-900">{ical?.totals?.errors ?? 0}</span>
              </p>
              <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">
                Последний старт: {formatDt(ical?.lastStartedAt)}
              </p>
              {ical?.lastErrorMessage ? (
                <p className="text-xs text-red-600 line-clamp-3">{ical.lastErrorMessage}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                  Push Sweeper
                </CardTitle>
                <StatusBadge status={sweeper?.lastStatus} />
              </div>
              <CardDescription>Восстановление зависших пачек push</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>
                <span className="text-slate-400">Доставлено (сумма за период):</span>{' '}
                <span className="font-semibold text-teal-700 text-lg">{sweeper?.totals?.delivered ?? 0}</span>
              </p>
              <p>
                <span className="text-slate-400">Найдено «зависших» строк (сумма):</span>{' '}
                <span className="font-medium text-slate-900">{sweeper?.totals?.stuck_found ?? 0}</span>
              </p>
              <p>
                <span className="text-slate-400">Запусков:</span>{' '}
                <span className="font-medium">{sweeper?.runCount ?? 0}</span>
                {' · '}
                <span className="text-emerald-600">OK {sweeper?.successRuns ?? 0}</span>
                {' / '}
                <span className="text-red-600">ошибок {sweeper?.errorRuns ?? 0}</span>
              </p>
              <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">
                Последний старт: {formatDt(sweeper?.lastStartedAt)}
              </p>
              {sweeper?.lastErrorMessage ? (
                <p className="text-xs text-red-600 line-clamp-3">{sweeper.lastErrorMessage}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trash2 className="h-5 w-5 text-slate-600" />
                  FCM Hygiene
                </CardTitle>
                <StatusBadge status={hygiene?.lastStatus} />
              </div>
              <CardDescription>Очистка мёртвых токенов</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-600">
              <p>
                <span className="text-slate-400">Удалено токенов (сумма):</span>{' '}
                <span className="font-semibold text-slate-900 text-lg">{hygiene?.totals?.removed ?? 0}</span>
              </p>
              <p>
                <span className="text-slate-400">Проверено (probed, сумма):</span>{' '}
                <span className="font-medium text-slate-800">{hygiene?.totals?.probed ?? 0}</span>
              </p>
              <p>
                <span className="text-slate-400">Запусков:</span>{' '}
                <span className="font-medium">{hygiene?.runCount ?? 0}</span>
                {' · '}
                <span className="text-emerald-600">OK {hygiene?.successRuns ?? 0}</span>
                {' / '}
                <span className="text-red-600">ошибок {hygiene?.errorRuns ?? 0}</span>
              </p>
              <p className="text-xs text-slate-400 pt-1 border-t border-slate-100">
                Последний старт: {formatDt(hygiene?.lastStartedAt)}
              </p>
              {hygiene?.lastErrorMessage ? (
                <p className="text-xs text-red-600 line-clamp-3">{hygiene.lastErrorMessage}</p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {data ? (
        <Card className="rounded-2xl border-slate-200 shadow-sm border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              Security Alerts
            </CardTitle>
            <CardDescription>
              Попытки подмены цены (PRICE_TAMPERING) за выбранное окно
              {security?.error ? ` — ${security.error}` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-slate-900">{security?.priceTamperingCount ?? 0}</span>
              <span className="text-sm text-slate-500">событий</span>
              {(security?.priceTamperingCount ?? 0) === 0 ? (
                <Badge className="rounded-lg bg-emerald-100 text-emerald-800 border-emerald-200">Норма</Badge>
              ) : (
                <Badge variant="destructive" className="rounded-lg">Требует внимания</Badge>
              )}
            </div>
            {Array.isArray(security?.recent) && security.recent.length > 0 ? (
              <ul className="space-y-2 text-sm border border-slate-100 rounded-xl p-3 bg-slate-50/80 max-h-56 overflow-y-auto">
                {security.recent.map((row) => (
                  <li key={row.id} className="flex flex-col gap-0.5 border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                    <span className="text-xs text-slate-400">{formatDt(row.created_at)}</span>
                    <span className="text-slate-700 font-mono text-xs break-all">
                      {typeof row.detail === 'object' ? JSON.stringify(row.detail) : String(row.detail || '—')}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Нет записей в ленте за период.</p>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
