'use client'

import { AlertTriangle, CheckCircle2, Download, FileArchive, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BATCH_STATUS_RU, resolvePayoutRailLabel } from '@/lib/admin/fintech-ui-labels'
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
 * @param {(id: string) => void} [onBankPackage]
 */
export function PayoutBatchRow({
  batch,
  settling,
  onLock,
  onExport,
  onSettle,
  onBankPackage,
  ownerMode = false,
}) {
  const status = String(batch.status || '').toUpperCase()
  const canSettleStatus = status === 'LOCKED' || status === 'EXPORTED'
  const settleBlocked = canSettleStatus && batch.canSettle === false
  const canSettleAction = canSettleStatus && batch.canSettle !== false
  const isDraft = status === 'DRAFT'
  const blockers = batch.settleBlockers || []

  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 shadow-sm space-y-3',
        canSettleAction && 'border-emerald-200 ring-1 ring-emerald-100',
        settleBlocked && 'border-amber-200 ring-1 ring-amber-100',
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
            <Badge
              variant={canSettleAction ? 'default' : 'secondary'}
              className={canSettleAction ? 'bg-emerald-600' : settleBlocked ? 'bg-amber-500' : ''}
            >
              {BATCH_STATUS_RU[batch.status] || batch.status}
            </Badge>
            {batch.rail ? (
              <Badge
                variant="outline"
                className={
                  batch.rail === 'KG_CRYPTO'
                    ? 'border-violet-300 text-violet-900'
                    : 'border-blue-300 text-blue-900'
                }
              >
                {resolvePayoutRailLabel(batch.rail, ownerMode)}
              </Badge>
            ) : null}
            <span className="text-sm font-medium text-slate-800">
              {batch.item_count ?? 0} броней · {fmtThb(batch.totals_thb)}
            </span>
          </div>
        </div>
        {canSettleStatus && (
          <Button
            size="default"
            className={cn(
              'shrink-0 h-10 px-4',
              canSettleAction
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-slate-200 text-slate-500 cursor-not-allowed hover:bg-slate-200',
            )}
            disabled={settling || settleBlocked}
            onClick={() => canSettleAction && onSettle(batch.id)}
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
        {onBankPackage && ['LOCKED', 'EXPORTED', 'SETTLED'].includes(status) ? (
          <Button size="sm" variant="outline" onClick={() => onBankPackage(batch.id)}>
            <FileArchive className="h-3.5 w-3.5 mr-1" />
            Пакет для банка (ZIP)
          </Button>
        ) : null}
      </div>
      {settleBlocked && blockers.length > 0 && (
        <div className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 space-y-1.5">
          <p className="font-medium flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Нельзя закрыть пул: у партнёров есть открытые заявки на вывод
          </p>
          <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
            {blockers.map((b) => (
              <li key={b.partnerId}>
                Партнёр {b.partnerId.slice(0, 8)}… —{' '}
                {(b.openRequests || [])
                  .map((r) => `${r.status} ${fmtThb(r.grossAmountThb)}`)
                  .join(', ')}
              </li>
            ))}
          </ul>
          <p className="text-amber-700">Обработайте или отмените заявки в разделе выплат, затем повторите.</p>
        </div>
      )}
      {canSettleAction && (
        <p className="text-xs text-emerald-800 bg-emerald-50 rounded-md px-2 py-1.5">
          После фактического перевода в банке нажмите зелёную кнопку — брони закроются, учёт синхронизируется.
        </p>
      )}
    </div>
  )
}
