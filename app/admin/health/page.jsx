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
import { JobErrorDetails, OpsJobFailureRow } from '@/components/admin/health/JobErrorDetails'
import { NotificationChannelsCard } from '@/components/admin/health/NotificationChannelsCard'
import { CriticalSignalsPanel } from '@/components/admin/health/CriticalSignalsPanel'

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
  const [reconcileBusy, setReconcileBusy] = useState(false)
  const [reconcileMsg, setReconcileMsg] = useState(null)

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

  const runReferralReconcileNow = useCallback(async () => {
    setReconcileBusy(true)
    setReconcileMsg(null)
    try {
      const res = await fetch('/api/v2/admin/referral/reconciliation-run', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun: false }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.success) {
        setReconcileMsg(json.error || `Ошибка ${res.status}`)
        return
      }
      const d = json.data || {}
      setReconcileMsg(
        `Готово: mismatch броней ${d.mismatchBookingCount ?? 0}, исправлено ${d.fixedByReconciliation ?? d.revertedBookingCount ?? 0}`,
      )
      await load()
    } catch (e) {
      setReconcileMsg(e?.message || 'Сеть')
    } finally {
      setReconcileBusy(false)
    }
  }, [load])

  const ical = data?.jobs?.['ical-sync']
  const sweeper = data?.jobs?.['push-sweeper']
  const hygiene = data?.jobs?.['push-token-hygiene']
  const slaNudgeJob = data?.jobs?.['partner-sla-telegram-nudge']
  const slaNudge = data?.slaNudge
  const security = data?.security
  const jobFailures = data?.jobFailures
  const notificationChannels = data?.notificationChannels
  const trustSafety = data?.trustSafety
  const referralReconcile = data?.referralReconciliation
  const referralReconcileJob = data?.jobs?.['referral-reconciliation']
  const referralSystemHealth = data?.referralSystemHealth
  const referralUnlock = data?.referralUnlock
  const referralUnlockJob = data?.jobs?.['referral-unlock']
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
    <div className="space-y-6 w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7 text-brand" />
            System Health
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Cron, платёжные адаптеры и сигналы безопасности за последние {data?.windowDays ?? 7} дн.
          </p>
          <Link
            href="/admin/marketplace-health"
            className="inline-flex mt-2 text-xs font-medium text-brand hover:text-brand-hover underline-offset-2 hover:underline"
          >
            Marketplace Health →
          </Link>
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
          <Loader2 className="h-10 w-10 animate-spin text-brand" />
        </div>
      ) : null}

      {data?.meta?.opsError ? (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-2">
          ops_job_runs: {data.meta.opsError}
        </p>
      ) : null}

      {Array.isArray(jobFailures) && jobFailures.length > 0 ? (
        <Card className="rounded-2xl border-amber-200 bg-amber-50/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-950">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
              Ошибки cron-джоб (ops_job_runs)
            </CardTitle>
            <CardDescription className="text-amber-900/80">
              Последние сбои за окно {data?.windowDays ?? 7} дн. — полный текст в раскрывающемся блоке.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {jobFailures.map((failure) => (
                <OpsJobFailureRow key={`${failure.jobName}-${failure.startedAt}`} failure={failure} />
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {data ? <NotificationChannelsCard channels={notificationChannels} /> : null}

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

      {data && referralSystemHealth ? (
        <Card
          className={`rounded-2xl border shadow-sm ${
            (referralSystemHealth.relationCycleCount ?? 0) > 0
              ? 'border-red-200 bg-red-50/40'
              : 'border-sky-100 bg-sky-50/30'
          }`}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-sky-950">
              <Activity className="h-5 w-5 text-sky-700" />
              Referral system health
            </CardTitle>
            <CardDescription className="text-sky-900/80">
              Очередь выводов и целостность дерева <code className="text-xs bg-white/80 px-1 rounded">referral_relations</code>.
              {' '}
              <Link href="/admin/marketing/referral-payouts" className="text-brand hover:underline">
                Payout Ops →
              </Link>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {referralSystemHealth.error ? (
              <p className="text-red-600 text-xs">{referralSystemHealth.error}</p>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="rounded-xl border border-sky-100 bg-white/70 px-3 py-2">
                <p className="text-slate-500">Активных FX-локов</p>
                <p className="text-xl font-bold tabular-nums text-sky-900 mt-1">
                  {referralSystemHealth.activeWithdrawalLocks ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-sky-100 bg-white/70 px-3 py-2">
                <p className="text-slate-500">Заморожено в очереди</p>
                <p className="text-xl font-bold tabular-nums text-sky-900 mt-1">
                  {Number(referralSystemHealth.frozenWithdrawalThb ?? 0).toLocaleString('ru-RU')} ฿
                </p>
              </div>
              <div
                className={`rounded-xl border px-3 py-2 ${
                  (referralSystemHealth.relationCycleCount ?? 0) > 0
                    ? 'border-red-200 bg-red-50/80'
                    : 'border-sky-100 bg-white/70'
                }`}
              >
                <p className="text-slate-500">Петли в ancestor_path</p>
                <p
                  className={`text-xl font-bold tabular-nums mt-1 ${
                    (referralSystemHealth.relationCycleCount ?? 0) > 0 ? 'text-red-800' : 'text-emerald-700'
                  }`}
                >
                  {referralSystemHealth.relationCycleCount ?? 0}
                </p>
              </div>
            </div>
            {Array.isArray(referralSystemHealth.relationCycleSample) &&
            referralSystemHealth.relationCycleSample.length > 0 ? (
              <ul className="text-xs space-y-1 max-h-32 overflow-y-auto border border-red-100 rounded-lg bg-white/80 p-2">
                {referralSystemHealth.relationCycleSample.map((row) => (
                  <li key={row.id} className="font-mono text-red-800">
                    relation {row.id} · referee {row.refereeId}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {data && referralUnlock ? (
        <Card className="rounded-2xl border border-amber-100 bg-amber-50/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-950">
              <Activity className="h-5 w-5 text-amber-700" />
              Referral unlock (холд → кошелёк)
            </CardTitle>
            <CardDescription className="text-amber-900/80">
              Крон{' '}
              <code className="text-xs bg-white/80 px-1 rounded">/api/cron/referral-unlock</code> —{' '}
              {referralUnlock.scheduleUtc || '15 5 * * *'} UTC. Разблокировка{' '}
              <code className="text-xs">earned_held</code> после <code className="text-xs">unlock_at</code>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Последний прогон</span>
              <StatusBadge status={referralUnlock.lastRun?.status || referralUnlockJob?.lastStatus} />
            </div>
            {referralUnlock.error ? <p className="text-red-600 text-xs">{referralUnlock.error}</p> : null}
            <p className="text-slate-600">
              Старт: {formatDt(referralUnlock.lastRun?.startedAt || referralUnlockJob?.lastStartedAt)}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-amber-100 bg-white/70 px-3 py-2">
                <p className="text-slate-500">За 24 ч</p>
                <p className="text-slate-800 mt-1">
                  Строк ledger: <strong>{referralUnlock.last24h?.unlockedCount ?? 0}</strong>
                </p>
                <p className="text-slate-800">
                  Сумма: <strong>{Number(referralUnlock.last24h?.unlockedAmountThb ?? 0).toLocaleString('ru-RU')} ฿</strong>
                </p>
                <p className="text-slate-500 mt-0.5">прогонов: {referralUnlock.last24h?.runCount ?? 0}</p>
              </div>
              <div className="rounded-xl border border-amber-100 bg-white/70 px-3 py-2">
                <p className="text-slate-500">Сегодня (UTC)</p>
                <p className="text-slate-800 mt-1">
                  Строк ledger: <strong>{referralUnlock.todayUtc?.unlockedCount ?? 0}</strong>
                </p>
                <p className="text-slate-800">
                  Сумма: <strong>{Number(referralUnlock.todayUtc?.unlockedAmountThb ?? 0).toLocaleString('ru-RU')} ฿</strong>
                </p>
                <p className="text-slate-500 mt-0.5">прогонов: {referralUnlock.todayUtc?.runCount ?? 0}</p>
              </div>
            </div>
            {referralUnlock.lastRun?.stats ? (
              <p className="text-xs text-slate-600">
                Последний прогон: броней {referralUnlock.lastRun.stats.bookingCount ?? '—'}, строк{' '}
                {referralUnlock.lastRun.stats.unlockedCount ?? '—'},{' '}
                {Number(referralUnlock.lastRun.stats.unlockedAmountThb ?? 0).toLocaleString('ru-RU')} ฿
              </p>
            ) : (
              <p className="text-xs text-slate-500">Прогонов в окне 7д: {referralUnlockJob?.runCount ?? 0}</p>
            )}
            {referralUnlock.lastRun?.errorMessage ? (
              <JobErrorDetails
                preview={referralUnlock.lastRun.errorMessage}
                message={referralUnlock.lastRun.errorMessage}
                label="Ошибка referral-unlock"
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {data && referralReconcile ? (
        <Card className="rounded-2xl border border-violet-100 bg-violet-50/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-violet-950">
              <ShieldAlert className="h-5 w-5 text-violet-700" />
              Referral reconciliation (FinTech lock)
            </CardTitle>
            <CardDescription className="text-violet-900/80">
              Крон{' '}
              <code className="text-xs bg-white/80 px-1 rounded">/api/cron/referral-reconciliation</code> —{' '}
              {referralReconcile.scheduleUtc || '30 4 * * *'} UTC. Сверка earned/pending ledger vs
              CANCELLED/REFUNDED брони.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500">Последний прогон (ops_job_runs)</span>
              <StatusBadge status={referralReconcile.lastRun?.status || referralReconcileJob?.lastStatus} />
            </div>
            {referralReconcile.error ? (
              <p className="text-red-600 text-xs">{referralReconcile.error}</p>
            ) : null}
            <p className="text-slate-600">
              Старт: {formatDt(referralReconcile.lastRun?.startedAt || referralReconcileJob?.lastStartedAt)}
            </p>
            <p className="text-slate-600">
              Исправлено reconciliation за 24 ч:{' '}
              <strong className="text-violet-900">{referralReconcile.fixedLast24h ?? 0}</strong>
              {referralReconcile.runCount24h != null ? (
                <span className="text-slate-500"> (прогонов: {referralReconcile.runCount24h})</span>
              ) : null}
            </p>
            {referralReconcile.lastRun?.stats ? (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700 rounded-xl border border-violet-100 bg-white/70 px-3 py-2">
                <span>
                  mismatch броней:{' '}
                  <strong>{referralReconcile.lastRun.stats.mismatchBookingCount ?? '—'}</strong>
                </span>
                <span>
                  строк ledger:{' '}
                  <strong>{referralReconcile.lastRun.stats.mismatchLedgerRows ?? '—'}</strong>
                </span>
                <span>
                  fixed: <strong>{referralReconcile.lastRun.stats.fixedByReconciliation ?? '—'}</strong>
                </span>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Прогонов в окне 7д: {referralReconcileJob?.runCount ?? 0}</p>
            )}
            {Array.isArray(referralReconcile.lastRun?.mismatches) &&
            referralReconcile.lastRun.mismatches.length > 0 ? (
              <ul className="text-xs space-y-1 max-h-40 overflow-y-auto border border-violet-100 rounded-lg bg-white/80 p-2">
                {referralReconcile.lastRun.mismatches.slice(0, 12).map((m) => (
                  <li key={m.bookingId} className="flex flex-col gap-0.5">
                    <Link
                      href={m.adminPath || `/admin/bookings/${encodeURIComponent(String(m.bookingId))}`}
                      className="font-mono text-brand hover:underline"
                    >
                      {m.bookingId}
                    </Link>
                    <span className="text-slate-500">
                      {m.bookingStatus} · ledger rows: {m.ledgerRowCount}
                      {Array.isArray(m.ledgerIds) && m.ledgerIds.length
                        ? ` · ids: ${m.ledgerIds.slice(0, 3).join(', ')}`
                        : ''}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="rounded-lg"
                disabled={reconcileBusy || loading}
                onClick={() => void runReferralReconcileNow()}
              >
                {reconcileBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Запустить reconciliation сейчас
              </Button>
              {reconcileMsg ? <span className="text-xs text-slate-600">{reconcileMsg}</span> : null}
            </div>
            {referralReconcile.lastRun?.errorMessage ? (
              <JobErrorDetails
                preview={referralReconcile.lastRun.errorMessage}
                message={referralReconcile.lastRun.errorMessage}
                label="Ошибка referral-reconciliation"
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
                        className="font-mono text-brand-hover hover:underline shrink-0"
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
        <Card className="rounded-2xl border-slate-200 shadow-sm border-l-4 border-l-brand">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircleWarning className="h-5 w-5 text-brand" />
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
                <span className="font-semibold text-brand-hover">{slaNudge?.events7d ?? 0}</span>
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
              <JobErrorDetails
                preview={slaNudgeJob.lastErrorPreview || slaNudgeJob.lastErrorMessage}
                message={slaNudgeJob.lastErrorMessage}
                label="Ошибка SLA Telegram nudge"
              />
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
                  <CalendarSync className="h-5 w-5 text-brand" />
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
                <JobErrorDetails
                  preview={ical.lastErrorPreview || ical.lastErrorMessage}
                  message={ical.lastErrorMessage}
                  label="Ошибка iCal sync"
                />
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
                <span className="font-semibold text-brand-hover text-lg">{sweeper?.totals?.delivered ?? 0}</span>
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
                <JobErrorDetails
                  preview={sweeper.lastErrorPreview || sweeper.lastErrorMessage}
                  message={sweeper.lastErrorMessage}
                  label="Ошибка push-sweeper"
                />
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
                <JobErrorDetails
                  preview={hygiene.lastErrorPreview || hygiene.lastErrorMessage}
                  message={hygiene.lastErrorMessage}
                  label="Ошибка FCM hygiene"
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {data ? (
        <CriticalSignalsPanel
          signals={security?.criticalSignals}
          windowDays={data.windowDays}
        />
      ) : null}
    </div>
  )
}
