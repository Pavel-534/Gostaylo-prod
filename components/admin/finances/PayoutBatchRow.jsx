'use client'

import { CheckCircle2, Download, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BATCH_STATUS_RU } from '@/lib/admin/fintech-ui-labels'
import { cn } from '@/lib/utils'

function fmtThb(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return `฿${x.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

/**
 * @param {object} props
 * @param {object} batch
 * @param {boolean} settling
 * @param {(id: string) => void} onLock
 * @param {(id: string) => void} onExport
 * @param {(id: string) => void} onSettle
 */
export function PayoutBatchRow({ batch, settling, onLock, onExport, onSettle }) {
  const canSettle = batch.status === 'LOCKED' || batch.status === 'EXPORTED'
  const isDraft = batch.status === 'DRAFT'

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm space-y-3',
        canSettle && 'border-emerald-200 ring-1 ring-emerald-100',
        isDraft && 'border-amber-100',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">
            {new Date(batch.scheduled_for || batch.created_at).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge variant={canSettle ? 'default' : 'secondary'} className={canSettle ? 'bg-emerald-600' : ''}>
              {BATCH_STATUS_RU[batch.status] || batch.status}
            </Badge>
            <span className="text-sm font-medium text-slate-800">
              {batch.item_count ?? 0} броней · {fmtThb(batch.totals_thb)}
            </span>
          </div>
        </div>
        {canSettle && (
          <Button
            size="default"
            className="bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 h-10 px-4"
            disabled={settling}
            onClick={() => onSettle(batch.id)}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />
            {settling ? 'Закрываем…' : 'Отметить как оплаченный'}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {isDraft && (
          <Button size="sm" variant="secondary" onClick={() => onLock(batch.id)}>
            <Lock className="h-3.5 w-3.5 mr-1" />
            Зафиксировать перед выгрузкой
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onExport(batch.id)}>
          <Download className="h-3.5 w-3.5 mr-1" />
          Скачать CSV для банка
        </Button>
      </div>
      {canSettle && (
        <p className="text-xs text-emerald-800 bg-emerald-50 rounded-md px-2 py-1.5">
          После фактического перевода в банке нажмите зелёную кнопку — брони закроются, учёт синхронизируется.
        </p>
      )}
    </div>
  )
}
