'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bell, MessageCircle, Smartphone } from 'lucide-react'

function SeverityFrame({ severity, children }) {
  const border =
    severity === 'critical'
      ? 'border-red-300 bg-red-50/50'
      : severity === 'warning'
        ? 'border-amber-300 bg-amber-50/50'
        : 'border-slate-200 bg-white'
  return <div className={`rounded-xl border p-3 ${border}`}>{children}</div>
}

function SeverityBadge({ severity }) {
  if (severity === 'critical') {
    return <Badge variant="destructive" className="rounded-lg">CRITICAL</Badge>
  }
  if (severity === 'warning') {
    return (
      <Badge className="rounded-lg bg-amber-500 hover:bg-amber-500 text-white border-0">WARNING</Badge>
    )
  }
  return <Badge className="rounded-lg bg-emerald-100 text-emerald-800 border-emerald-200">OK</Badge>
}

function formatPct(v) {
  return v != null && Number.isFinite(v) ? `${v}%` : '—'
}

/**
 * @param {{ channels?: import('@/lib/admin/notification-channel-health').loadNotificationChannelHealth extends (...args: any) => Promise<infer R> ? R : never }} props
 */
export function NotificationChannelsCard({ channels }) {
  if (!channels) return null

  const tg = channels.telegram
  const fcm = channels.fcm
  const headline = tg?.headline

  return (
    <Card
      className={`rounded-2xl border shadow-sm ${
        headline?.severity === 'critical'
          ? 'border-red-200'
          : headline?.severity === 'warning'
            ? 'border-amber-200'
            : 'border-slate-200'
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5 text-brand" />
            Каналы уведомлений (24 ч)
          </CardTitle>
          <SeverityBadge severity={headline?.severity} />
        </div>
        <CardDescription>
          Telegram SLA-напоминания и outbox; FCM — гигиена токенов и сигналы очистки.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 text-sm">
        <SeverityFrame severity={headline?.severity}>
          <p className="font-medium text-slate-800 flex items-center gap-2 mb-2">
            <MessageCircle className="h-4 w-4 text-sky-600" />
            Telegram
          </p>
          <p className="text-slate-600">
            Успешная доставка:{' '}
            <span className="text-xl font-bold tabular-nums text-slate-900">
              {formatPct(headline?.successPercent)}
            </span>
            {headline?.failPercent != null ? (
              <span className="text-xs text-slate-500 ml-2">ошибок {formatPct(headline.failPercent)}</span>
            ) : null}
          </p>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            <p>
              SLA cron: отправлено <strong>{tg?.slaNudge?.sent ?? 0}</strong>, ошибок{' '}
              <strong>{tg?.slaNudge?.errors ?? 0}</strong>, пропущено {tg?.slaNudge?.skipped ?? 0} (прогонов{' '}
              {tg?.slaNudge?.runCount ?? 0})
            </p>
            {tg?.outbox?.tablePresent !== false ? (
              <p>
                Outbox (все каналы): sent {tg?.outbox?.sent ?? 0}, failed{' '}
                {(tg?.outbox?.failed ?? 0) + (tg?.outbox?.permanentFailure ?? 0)}
                {tg?.outbox?.successPercent != null ? ` · ${formatPct(tg.outbox.successPercent)} OK` : ''}
              </p>
            ) : (
              <p className="text-slate-400">notification_outbox не найден</p>
            )}
            {tg?.outbox?.error ? <p className="text-red-600">{tg.outbox.error}</p> : null}
          </div>
        </SeverityFrame>

        <SeverityFrame severity={null}>
          <p className="font-medium text-slate-800 flex items-center gap-2 mb-2">
            <Smartphone className="h-4 w-4 text-violet-600" />
            FCM
          </p>
          <p className="text-slate-600">
            Очищено невалидных токенов:{' '}
            <span className="text-xl font-bold tabular-nums text-slate-900">
              {fcm?.tokensRemovedTotal ?? 0}
            </span>
          </p>
          <div className="mt-2 space-y-1 text-xs text-slate-600">
            <p>
              Крон hygiene: <strong>{fcm?.tokensRemovedByHygieneCron ?? 0}</strong> удалено (probed{' '}
              {fcm?.tokensProbedByHygieneCron ?? 0}, прогонов {fcm?.hygieneRuns24h ?? 0})
            </p>
            <p>
              Сигналы <code className="bg-slate-100 px-1 rounded">FCM_TOKEN_CLEANED</code>:{' '}
              <strong>{fcm?.cleanedSignals24h ?? 0}</strong>
            </p>
            {fcm?.cleanedSignalsError ? (
              <p className="text-red-600">{fcm.cleanedSignalsError}</p>
            ) : null}
          </div>
        </SeverityFrame>
      </CardContent>
    </Card>
  )
}
