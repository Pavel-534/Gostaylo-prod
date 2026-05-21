'use client'

import Link from 'next/link'
import { ArrowLeft, Landmark, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { FINTECH_NAVY } from '@/lib/admin/fintech-console-shared'
import { FinTechConsoleHeaderAlerts } from '@/components/admin/finances/FinTechConsoleHeaderAlerts'

export function FinTechConsoleHeader({ dash, statCards, loading, onRefresh }) {
  return (
    <div
      className="border-b border-slate-200/80"
      style={{ background: `linear-gradient(135deg, ${FINTECH_NAVY} 0%, #134e4a 100%)` }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link
              href="/admin/settings"
              className="inline-flex items-center text-sm text-teal-200/90 hover:text-white mb-2"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Настройки
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
              <Landmark className="h-8 w-8 text-teal-300" />
              Финансовый пульт
            </h1>
            <p className="text-teal-100/80 text-sm mt-1 max-w-xl">
              Цены, онлайн-касса, выплаты партнёрам и выгрузки для банка. Только для владельца и
              администратора.
            </p>
            <div className="mt-3">
              <FinTechConsoleHeaderAlerts alerts={dash?.alerts} />
            </div>
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
              <div className="flex items-center gap-2 text-teal-200/90 text-xs font-medium">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className={cn('text-xl font-bold mt-1', danger && 'text-red-300')}>{value}</div>
              <div className="text-xs text-teal-100/70">{sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
