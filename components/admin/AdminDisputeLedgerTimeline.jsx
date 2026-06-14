'use client'

import { useMemo } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  Banknote,
  GitBranch,
  Landmark,
  Lock,
  Unlock,
} from 'lucide-react'

function iconForTone(tone) {
  switch (String(tone || '').toLowerCase()) {
    case 'escrow':
      return Landmark
    case 'hold':
      return Lock
    case 'release':
    case 'payout':
      return Unlock
    case 'refund':
      return ArrowDownLeft
    case 'split':
      return GitBranch
    case 'block':
      return Ban
    default:
      return Banknote
  }
}

function toneClasses(tone) {
  switch (String(tone || '').toLowerCase()) {
    case 'escrow':
      return 'border-brand/25 bg-brand/10 text-brand-hover'
    case 'hold':
    case 'block':
      return 'border-amber-300/80 bg-amber-50 text-amber-900'
    case 'refund':
      return 'border-rose-200 bg-rose-50 text-rose-900'
    case 'split':
      return 'border-violet-200 bg-violet-50 text-violet-900'
    case 'release':
    case 'payout':
      return 'border-emerald-200 bg-emerald-50 text-emerald-900'
    default:
      return 'border-slate-200 bg-white text-slate-700'
  }
}

function formatWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

function formatThb(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `฿${x.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

/**
 * Финансовый ledger-таймлайн по брони (эскроу → холд → refund/split/release).
 */
export default function AdminDisputeLedgerTimeline({ items = [], holdStatus = null }) {
  const rows = useMemo(() => {
    return [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  }, [items])

  if (!rows.length) {
    return (
      <div className="text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl p-4">
        Проводок по брони пока нет (оплата / холд / возврат появятся после соответствующих действий).
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
        <p className="text-sm font-semibold text-slate-900">Движение денег (ledger)</p>
        {holdStatus?.active ? (
          <span className="text-xs font-medium text-amber-900 bg-amber-100 border border-amber-200 rounded-lg px-2 py-1">
            Активный холд {holdStatus.amountThb != null ? formatThb(holdStatus.amountThb) : ''}
          </span>
        ) : holdStatus?.settled ? (
          <span className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
            Холд погашен
          </span>
        ) : null}
      </div>

      <ul className="relative space-y-0 pl-0">
        <li className="absolute left-[15px] top-2 bottom-2 w-px bg-slate-200" aria-hidden />

        {rows.map((row, idx) => {
          const Icon = iconForTone(row.tone)
          const chip = toneClasses(row.tone)
          const outflow = ['refund', 'block'].includes(String(row.direction))

          return (
            <li key={row.id || `${idx}-${row.createdAt}`} className="relative flex gap-3 pb-4 pl-1">
              <div
                className={`relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border shadow-sm ${chip}`}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
              </div>
              <div className="min-w-0 flex-1 pt-0.5 border-b border-slate-100/80 pb-3 last:border-0">
                <div className="flex flex-wrap items-baseline gap-2 gap-y-1">
                  <span className="text-sm font-medium text-slate-900">{row.label}</span>
                  <span className="text-xs font-mono text-slate-500">{formatWhen(row.createdAt)}</span>
                  {row.amountThb != null ? (
                    <span
                      className={`text-sm font-semibold tabular-nums ${outflow ? 'text-rose-800' : 'text-slate-900'}`}
                    >
                      {outflow ? (
                        <span className="inline-flex items-center gap-0.5">
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                          {formatThb(row.amountThb)}
                        </span>
                      ) : (
                        formatThb(row.amountThb)
                      )}
                    </span>
                  ) : null}
                </div>
                {row.detail ? <p className="text-xs text-slate-600 mt-1 break-words">{row.detail}</p> : null}
                {row.eventType ? (
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 mt-1 font-mono">{row.eventType}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
