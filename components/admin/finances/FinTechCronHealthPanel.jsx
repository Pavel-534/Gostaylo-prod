'use client'

import { AlertTriangle, CheckCircle2, Clock, Loader2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function fmtWhen(iso) {
  if (!iso) return 'ещё не было запуска'
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

function statusBadge(job) {
  if (job.lastStatus === 'error') {
    return { text: 'Ошибка', className: 'bg-red-100 text-red-900' }
  }
  if (job.stale) {
    return job.status === 'missing'
      ? { text: 'Нет данных', className: 'bg-red-100 text-red-900' }
      : { text: 'Давно не бегал', className: 'bg-amber-100 text-amber-950' }
  }
  return { text: 'В норме', className: 'bg-emerald-100 text-emerald-900' }
}

/**
 * @param {{ cronHealth?: { jobs?: object[], opsTableMissing?: boolean, loadError?: string }, ownerMode?: boolean, loading?: boolean }} props
 */
export function FinTechCronHealthPanel({ cronHealth, ownerMode = true, loading = false }) {
  const jobs = cronHealth?.jobs || []
  const anyStale = jobs.some((j) => j.stale)
  const anyError = jobs.some((j) => j.lastStatus === 'error')

  return (
    <Card
      className={cn(
        'border shadow-sm',
        anyStale || anyError ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200',
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
          <Clock className="h-5 w-5 text-teal-700" />
          Состояние автоматических задач
        </CardTitle>
        <CardDescription className="text-sm">
          {ownerMode
            ? 'Фоновые процессы, которые размораживают оплаты и готовят выплаты. Если давно не работали — деньги могут задержаться.'
            : 'Последние прогоны из ops_job_runs (внешний cron, см. CRON_EXTERNAL_FINANCIAL.md).'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Проверяем расписание…
          </p>
        ) : cronHealth?.opsTableMissing ? (
          <p className="text-sm text-amber-800">
            Журнал cron пока недоступен (таблица ops_job_runs). Обратитесь к разработчику.
          </p>
        ) : cronHealth?.loadError ? (
          <p className="text-sm text-red-700">{cronHealth.loadError}</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {jobs.map((job) => {
              const badge = statusBadge(job)
              const Icon = job.stale ? AlertTriangle : CheckCircle2
              const title = ownerMode ? job.labelOwner || job.label : job.label
              return (
                <div
                  key={job.jobName}
                  className={cn(
                    'rounded-lg border px-3 py-2.5 flex gap-2',
                    job.stale ? 'border-amber-200 bg-white' : 'border-slate-200 bg-slate-50/80',
                  )}
                >
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0 mt-0.5',
                      job.stale ? 'text-amber-600' : 'text-emerald-600',
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-slate-900 leading-snug">{title}</p>
                    <p className="text-xs text-slate-600 mt-1">
                      Последний запуск: {fmtWhen(job.lastFinishedAt || job.lastStartedAt)}
                    </p>
                    {!ownerMode && job.jobName ? (
                      <p className="text-[10px] font-mono text-slate-400 mt-0.5">{job.jobName}</p>
                    ) : null}
                    {job.lastErrorMessage && !ownerMode ? (
                      <p className="text-xs text-red-600 mt-1 truncate">{job.lastErrorMessage}</p>
                    ) : null}
                    <Badge className={cn('mt-2 text-[10px]', badge.className)}>{badge.text}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        {anyStale && !loading ? (
          <p className="text-xs text-amber-900 bg-amber-100/80 rounded-md px-2 py-1.5">
            Если индикатор жёлтый или красный больше 3 часов — проверьте внешний планировщик (cron-job.org).
            Уведомление уйдёт в Telegram FINANCE.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
