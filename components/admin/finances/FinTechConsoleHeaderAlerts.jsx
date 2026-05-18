'use client'

import { AlertTriangle, Banknote, Receipt } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

function fmtThb(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `฿${x.toLocaleString('ru-RU', { maximumFractionDigits: 0 })}`
}

/**
 * Header alert badges for treasury console (Stage 101.3).
 */
export function FinTechConsoleHeaderAlerts({ alerts }) {
  if (!alerts) return null

  const items = []

  if (alerts.fiscalAlert) {
    items.push({
      key: 'fiscal',
      tone: 'red',
      icon: Receipt,
      label: `Чеки: ${alerts.pendingFiscalCount} в очереди`,
    })
  }

  if (alerts.driftAlert) {
    items.push({
      key: 'drift',
      tone: 'red',
      icon: AlertTriangle,
      label: `Книга: расхождение ${fmtThb(alerts.ledgerDriftThb)}`,
    })
  }

  if (alerts.payoutAlert) {
    items.push({
      key: 'payout',
      tone: 'amber',
      icon: Banknote,
      label: `К выплате: ${fmtThb(alerts.readyForPayoutThb)} (порог ${fmtThb(alerts.readyForPayoutAlertThb)})`,
    })
  }

  if (!items.length) {
    return (
      <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30 hover:bg-emerald-500/20">
        Всё в норме
      </Badge>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ key, tone, icon: Icon, label }) => (
        <Badge
          key={key}
          className={cn(
            'gap-1 font-medium border',
            tone === 'red'
              ? 'bg-red-500/25 text-red-50 border-red-400/40 hover:bg-red-500/25 animate-pulse'
              : 'bg-amber-400/25 text-amber-50 border-amber-300/40 hover:bg-amber-400/25',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </Badge>
      ))}
    </div>
  )
}
