'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, RefreshCw, ShieldAlert } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const TYPE_LABELS = {
  TREASURY_PAYMENT_LARGE: 'Крупная оплата',
  TREASURY_READY_POOL: 'Готово к выплате',
  TREASURY_LEDGER_DRIFT: 'Drift ledger',
  TREASURY_FISCAL_PENDING: 'PENDING_FISCAL',
  TREASURY_WEBHOOK_ERROR: 'Webhook',
  TREASURY_EMERGENCY_PAUSE: 'Emergency Pause',
}

function severityClass(sev) {
  if (sev === 'critical') return 'bg-red-100 text-red-900 border-red-200'
  if (sev === 'warn') return 'bg-amber-100 text-amber-900 border-amber-200'
  return 'bg-slate-100 text-slate-800 border-slate-200'
}

export function FinTechTreasuryMonitoringPanel() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/finances/treasury-ops')
      const json = await res.json()
      if (json.success) setData(json.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const alerts = data?.recentAlerts || []
  const th = data?.thresholds || {}

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bell className="h-5 w-5 text-teal-600" />
          Мониторинг
        </CardTitle>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
          Обновить
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
          <div className="rounded-lg border bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Оплата от</span>
            <p className="font-semibold">฿{(th.paymentThbMin ?? 50000).toLocaleString('ru-RU')}</p>
          </div>
          <div className="rounded-lg border bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Пул готов от</span>
            <p className="font-semibold">฿{(th.readyPoolThbMin ?? 100000).toLocaleString('ru-RU')}</p>
          </div>
          <div className="rounded-lg border bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Drift от</span>
            <p className="font-semibold">฿{th.ledgerDriftThbMin ?? 0.5}</p>
          </div>
          <div className="rounded-lg border bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Fiscal pending</span>
            <p className="font-semibold">{data?.pendingFiscalCount ?? '—'} броней</p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          Алерты дублируются в Telegram (топик FINANCE). Повтор того же типа — не чаще 1 раза в 30 мин.
        </p>

        {alerts.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center rounded-lg border border-dashed">
            {loading ? 'Загрузка…' : 'Событий мониторинга пока нет — это нормально после чистой сверки.'}
          </p>
        ) : (
          <ul className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {alerts.map((a) => (
              <li
                key={a.id || `${a.at}-${a.type}`}
                className="rounded-lg border bg-white px-3 py-2.5 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={severityClass(a.severity)}>
                    {TYPE_LABELS[a.type] || a.type}
                  </Badge>
                  {a.telegramSent ? (
                    <span className="text-[10px] text-teal-700 font-medium">TG ✓</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {a.at ? new Date(a.at).toLocaleString('ru-RU') : ''}
                  </span>
                </div>
                <p className="font-medium mt-1 text-slate-900">{a.title}</p>
                {a.detail ? <p className="text-xs text-slate-600 mt-0.5">{a.detail}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
