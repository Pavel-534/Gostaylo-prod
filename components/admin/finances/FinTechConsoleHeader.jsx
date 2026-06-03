'use client'

import Link from 'next/link'
import { ArrowLeft, ArrowRight, Landmark, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { GSL_FINTECH_HERO_GRADIENT } from '@/lib/theme/product-ui'
import { FinTechConsoleHeaderAlerts } from '@/components/admin/finances/FinTechConsoleHeaderAlerts'

export function FinTechConsoleHeader({ dash, statCards, loading, onRefresh, liveMonitoring }) {
  const cl = liveMonitoring?.controlledLive
  const active = Boolean(cl?.active)
  const m = liveMonitoring || {}
  const drift = Number(m.driftThb) || 0

  return (
    <div className={cn('border-b border-slate-200/80', GSL_FINTECH_HERO_GRADIENT)}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 text-white">
        {active ? (
          <div className="mb-4 rounded-xl border-2 border-emerald-300/80 bg-emerald-500/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
              </span>
              <span className="font-bold tracking-wide text-emerald-50">CONTROLLED LIVE: ACTIVE</span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-emerald-50/95 tabular-nums">
              <span>24ч: <strong>{m.payments24h ?? 0}</strong> оплат</span>
              <span>Escrow: <strong>{m.paidEscrowAwaitingThaw ?? 0}</strong></span>
              <span>Drift: <strong>฿{drift.toFixed(2)}</strong></span>
              <span>Webhook 7д: <strong>{m.webhookErrors7d ?? 0}</strong></span>
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/settings"
              className="inline-flex items-center text-sm text-white/80 hover:text-white mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Настройки
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-8 w-8 text-white/70" />
              Финансовый пульт
            </h1>
            <p className="text-white/70 text-sm mt-1 max-w-xl">
              Цены, онлайн-касса, выплаты партнёрам и выгрузки для банка. Только для владельца и
              администратора.
            </p>
            <div className="mt-3">
              <FinTechConsoleHeaderAlerts alerts={dash?.alerts} />
            </div>
            <Link
              href="/admin/finance/intelligence"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/15 border border-white/25 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25 hover:border-white/40"
            >
              <Landmark className="h-4 w-4 text-amber-200" />
              Financial Intelligence
              <span className="text-white/70 font-normal hidden sm:inline">
                — GMV, margin, escrow, P&L
              </span>
              <ArrowRight className="h-4 w-4 ml-1 text-white/80" />
            </Link>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="bg-white/10 text-white border-white/20 hover:bg-white/20"
          >
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            Обновить
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 mt-6">
          {statCards.map(({ label, value, sub, icon: Icon, danger }) => (
            <div
              key={label}
              className="rounded-xl bg-white/10 backdrop-blur border border-white/10 px-4 py-3"
            >
              <div className="flex items-center gap-2 text-white/80 text-xs font-medium">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className={cn('text-xl font-bold mt-1', danger && 'text-red-300')}>{value}</div>
              <div className="text-xs text-white/60">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
