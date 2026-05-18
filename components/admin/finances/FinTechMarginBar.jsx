'use client'

import { cn } from '@/lib/utils'

function fmtThb(n) {
  const x = Number(n)
  if (!Number.isFinite(x) || x < 0) return '0'
  return x.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

/**
 * Visual margin waterfall: accepted → payouts + losses → net.
 */
export function FinTechMarginBar({ acceptedThb, paidOutThb, lossesThb, netMarginThb, className }) {
  const accepted = Math.max(0, Number(acceptedThb) || 0)
  const paid = Math.max(0, Number(paidOutThb) || 0)
  const losses = Math.max(0, Number(lossesThb) || 0)
  const net = Number(netMarginThb)
  const netSafe = Number.isFinite(net) ? net : accepted - paid - losses

  if (accepted <= 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500',
          className,
        )}
      >
        Нет поступлений за период — маржа появится после оплат гостей.
      </div>
    )
  }

  const paidPct = Math.min(100, (paid / accepted) * 100)
  const lossPct = Math.min(100 - paidPct, (losses / accepted) * 100)
  const netPct = Math.max(0, 100 - paidPct - lossPct)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex h-10 w-full overflow-hidden rounded-lg border border-slate-200 shadow-inner">
        {paidPct > 0.5 ? (
          <div
            className="bg-slate-400 flex items-center justify-center text-[10px] font-medium text-white px-1"
            style={{ width: `${paidPct}%` }}
            title={`Выплаты: ฿${fmtThb(paid)}`}
          >
            {paidPct > 12 ? 'Выплаты' : ''}
          </div>
        ) : null}
        {lossPct > 0.5 ? (
          <div
            className="bg-rose-500 flex items-center justify-center text-[10px] font-medium text-white px-1"
            style={{ width: `${lossPct}%` }}
            title={`Потери FX: ฿${fmtThb(losses)}`}
          >
            {lossPct > 12 ? 'Потери' : ''}
          </div>
        ) : null}
        {netPct > 0.5 ? (
          <div
            className={cn(
              'flex items-center justify-center text-[10px] font-medium text-white px-1',
              netSafe >= 0 ? 'bg-emerald-600' : 'bg-red-600',
            )}
            style={{ width: `${netPct}%` }}
            title={`Чистая маржа: ฿${fmtThb(netSafe)}`}
          >
            {netPct > 12 ? 'Маржа' : ''}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-400 shrink-0" />
          Выплаты ฿{fmtThb(paid)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500 shrink-0" />
          Потери ฿{fmtThb(losses)}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-sm shrink-0',
              netSafe >= 0 ? 'bg-emerald-600' : 'bg-red-600',
            )}
          />
          Чистая ฿{fmtThb(netSafe)}
        </div>
      </div>
    </div>
  )
}
