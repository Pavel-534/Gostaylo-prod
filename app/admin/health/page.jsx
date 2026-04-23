'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity,
  AlertTriangle,
  CalendarSync,
  Loader2,
  MessageCircleWarning,
  RefreshCw,
  ShieldAlert,
  Siren,
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
  const [adapterHealth, setAdapterHealth] = useState(null)
  const [adapterHealthError, setAdapterHealthError] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    setAdapterHealthError(null)
    try {
      const [healthRes, adaptersRes] = await Promise.all([
        fetch('/api/v2/admin/health', { credentials: 'include' }),
        fetch('/api/v2/admin/payment-adapters/health', { credentials: 'include' }),
      ])

      const json = await healthRes.json().catch(() => ({}))
      if (!healthRes.ok) {
        setData(null)
        setError(json.error || `Ошибка ${healthRes.status}`)
        return
      }
      if (!json.success) {
        setData(null)
        setError(json.error || 'Не удалось загрузить данные')
        return
      }
      setData(json)

      const adaptersJson = await adaptersRes.json().catch(() => ({}))
      if (!adaptersRes.ok || !adaptersJson?.success) {
        setAdapterHealth(null)
        setAdapterHealthError(adaptersJson?.error || `Ошибка ${adaptersRes.status}`)
      } else {
        setAdapterHealth(adaptersJson.data || null)
      }
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
  const slaNudgeJob = data?.jobs?.['partner-sla-telegram-nudge']
  const slaNudge = data?.slaNudge
  const security = data?.security
  const trustSafety = data?.trustSafety
  const adapterEntries = Object.entries(adapterHealth?.adapters || {})
  const hasAdapterProblems = adapterEntries.some(([, row]) => !row?.ready) || !adapterHealth?.global?.ready

  function EnvReadinessBadge({ ok }) {
    return (
      <span
        className={`inline-flex h-3 w-3 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'}`}
        aria-label={ok ? 'ready' : 'missing'}
      />
    )
  }

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

      <Card className={`rounded-2xl border shadow-sm ${hasAdapterProblems ? 'border-red-200' : 'border-emerald-200'}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldAlert className={`h-5 w-5 ${hasAdapterProblems ? 'text-red-600' : 'text-emerald-600'}`} />
            Payment Adapters Health
          </CardTitle>
          <CardDescription>
            Проверка готовности ENV для live-подключения CARD_INTL / MIR_RU
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {adapterHealthError ? (
            <p className="text-red-600">{adapterHealthError}</p>
          ) : null}
          {!adapterHealthError && !adapterHealth ? (
            <p className="text-slate-500">Нет данных</p>
          ) : null}
          {adapterHealth ? (
            <>
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50">
                <p className="font-medium text-slate-800 flex items-center gap-2">
                  <EnvReadinessBadge ok={Boolean(adapterHealth.global?.ready)} />
                  Global secrets
                </p>
                {Array.isArray(adapterHealth.global?.missing) && adapterHealth.global.missing.length > 0 ? (
                  <p className="text-xs text-red-600 mt-1">Missing: {adapterHealth.global.missing.join(', ')}</p>
                ) : (
                  <p className="text-xs text-emerald-700 mt-1">Все ключи на месте</p>
                )}
              </div>
              {adapterEntries.map(([key, row]) => (
                <div key={key} className="rounded-xl border border-slate-200 p-3 bg-white">
                  <p className="font-medium text-slate-800 flex items-center gap-2">
                    <EnvReadinessBadge ok={Boolean(row?.ready)} />
                    {key} {row?.mode ? `(${row.mode})` : ''}
                  </p>
                  {Array.isArray(row?.missing) && row.missing.length > 0 ? (
                    <p className="text-xs text-red-600 mt-1">Missing: {row.missing.join(', ')}</p>
                  ) : (
                    <p className="text-xs text-emerald-700 mt-1">Все ключи на месте</p>
                  )}
                </div>
              ))}
            </>
          ) : null}
        </CardContent>
      </Card>

      {data && trustSafety ? (
        <Card className="rounded-2xl border border-rose-100 bg-rose-50/40 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-rose-950">
              <Siren className="h-5 w-5 text-rose-700" />
              Trust &amp; Safety — экстренные вызовы (24 ч)
            </CardTitle>
            <CardDescription className="text-rose-900/80">
              Счётчик по событиям в <code className="text-xs bg-white/80 px-1 rounded">bookings.metadata.emergency_contact_events</code> у
              броней, обновлённых за последние 24 ч (выборка до 5000 строк).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-slate-800">
              <span className="text-slate-500">Событий за 24 ч:</span>{' '}
              <span className="text-2xl font-bold tabular-nums text-rose-800">{trustSafety.emergencyContacts24h ?? 0}</span>
            </p>
            {trustSafety.emergencyScanError ? (
              <p className="text-red-700 text-xs">{trustSafety.emergencyScanError}</p>
            ) : (
              <p className="text-xs text-slate-500">
                Окно отсчёта: с {formatDt(trustSafety.emergencyScanSince)}
              </p>
            )}
            {Array.isArray(trustSafety.emergencyRecentBookings) && trustSafety.emergencyRecentBookings.length > 0 ? (
              <div className="pt-2 border-t border-rose-100">
                <p className="text-xs font-medium text-rose-900 mb-2">События (клик — карточка брони)</p>
                <ul className="space-y-2 text-xs text-slate-700 max-h-56 overflow-y-auto pr-1">
                  {trustSafety.emergencyRecentBookings.map((row) => (
                    <li key={`${row.bookingId}-${row.at}`} className="flex flex-col sm:flex-row sm:items-baseline sm:gap-x-3 gap-0.5 rounded-lg bg-white/70 border border-rose-100/80 px-2 py-1.5">
                      <Link
                        href={`/admin/bookings/${encodeURIComponent(String(row.bookingId))}`}
                        className="font-mono text-teal-700 hover:underline shrink-0"
                      >
                        {row.bookingId}
                      </Link>
                      <span className="text-slate-500 whitespace-nowrap">{formatDt(row.at)}</span>
                      <span className="text-slate-600 sm:flex-1">{row.reasonsRu}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {data ? (
        <Card className="rounded-2xl border-slate-200 shadow-sm border-l-4 border-l-teal-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircleWarning className="h-5 w-5 text-teal-600" />
                SLA Telegram nudge
              </CardTitle>
              <StatusBadge status={slaNudgeJob?.lastStatus} />
            </div>
            <CardDescription>
              Крон <code className="text-xs bg-slate-100 px-1 rounded">/api/cron/partner-sla-telegram-nudge</code> —{' '}
              dedup в <code className="text-xs bg-slate-100 px-1">partner_sla_nudge_events</code>; «покрытие» = доля
              реально отправленных TG от числа записей в БД за окно (если нет TG у партнёра — запись есть, отправки
              нет).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-600">
            {!slaNudge?.tablePresent ? (
              <p className="text-amber-700">Таблица partner_sla_nudge_events не найдена — примените миграцию 041.</p>
            ) : null}
            {slaNudge?.error ? <p className="text-red-600">{slaNudge.error}</p> : null}
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <p>
                <span className="text-slate-400">Покрытие TG / БД (7д):</span>{' '}
                <span className="font-semibold text-slate-900">
                  {slaNudge?.telegramVsDbPercent != null ? `${slaNudge.telegramVsDbPercent}%` : '—'}
                </span>
                {slaNudge?.telegramVsDbPercent != null ? (
                  <span className="text-xs text-slate-500 ml-1">
                    ({slaNudge?.opsSent7d ?? 0} отправлено / {slaNudge?.events7d ?? 0} якорей в БД)
                  </span>
                ) : null}
              </p>
              <p>
                <span className="text-slate-400">Записей в БД (7д):</span>{' '}
                <span className="font-semibold text-teal-700">{slaNudge?.events7d ?? 0}</span>
              </p>
              <p>
                <span className="text-slate-400">Уникальных партнёров (оценка, до 5k строк):</span>{' '}
                <span className="font-medium text-slate-900">{slaNudge?.uniquePartnersSample ?? 0}</span>
              </p>
            </div>
            <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">
              Ops (сумма за 7д): scanned {slaNudge?.opsScanned7d ?? 0} · sent {slaNudge?.opsSent7d ?? 0} · skipped{' '}
              {slaNudge?.opsSkipped7d ?? 0} · errors {slaNudge?.opsErrors7d ?? 0} · прогонов{' '}
              {slaNudgeJob?.runCount ?? 0} (OK {slaNudgeJob?.successRuns ?? 0} / ошибок {slaNudgeJob?.errorRuns ?? 0})
            </p>
            <p className="text-xs text-slate-400">
              Последнее событие в БД: {formatDt(slaNudge?.lastCreatedAt)} · последний крон:{' '}
              {formatDt(slaNudgeJob?.lastStartedAt)}
            </p>
            {slaNudgeJob?.lastErrorMessage ? (
              <p className="text-xs text-red-600 line-clamp-3">{slaNudgeJob.lastErrorMessage}</p>
            ) : null}
          </CardContent>
        </Card>
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
