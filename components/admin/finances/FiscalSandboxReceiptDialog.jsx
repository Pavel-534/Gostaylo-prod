'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'

const MINT = '#0D9488'
const NAVY = '#0F172A'

/**
 * @param {{ open: boolean, onOpenChange: (v: boolean) => void, display: object | null }} props
 */
export function FiscalSandboxReceiptDialog({ open, onOpenChange, display }) {
  if (!display) return null

  const split = display.commissionSplit || {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={{ color: NAVY }}>{display.title}</DialogTitle>
          <DialogDescription>
            Песочница — в OFD ничего не уходит. Так бэкенд собирает чек для гостя из РФ.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-lg border border-teal-100 bg-teal-50/50 p-4 space-y-2">
            <p>
              <span className="text-slate-500">ИНН агента (РФ ИП):</span>{' '}
              <span className="font-mono font-semibold">{display.ruAgentInn}</span>
            </p>
            <p className="text-slate-700">{display.agentSignLabel}</p>
            <p>
              <span className="text-slate-500">Тег 1224 (поставщик / ОсОО КР):</span>{' '}
              <span className="font-medium">{display.tag1224KgSupplier}</span>
            </p>
            <p className="text-slate-600">{display.paymentMethod}</p>
                    </div>

          <div>
            <p className="font-medium mb-2" style={{ color: NAVY }}>
              Сплит комиссий (฿)
            </p>
            <ul className="grid grid-cols-2 gap-2">
              <li className="rounded-md bg-white border px-3 py-2">
                <span className="text-xs text-slate-500 block">Доля РФ (ИП)</span>
                <span className="font-semibold tabular-nums">฿{split.ruIpThb ?? 0}</span>
              </li>
              <li className="rounded-md bg-white border px-3 py-2">
                <span className="text-xs text-slate-500 block">Доля КР (ИТ)</span>
                <span className="font-semibold tabular-nums">฿{split.krItThb ?? 0}</span>
              </li>
              <li className="rounded-md bg-white border px-3 py-2">
                <span className="text-xs text-slate-500 block">Курсовой спред</span>
                <span className="font-semibold tabular-nums">฿{split.fxSpreadThb ?? 0}</span>
              </li>
              <li className="rounded-md bg-white border px-3 py-2">
                <span className="text-xs text-slate-500 block">Транзит хосту</span>
                <span className="font-semibold tabular-nums">฿{split.partnerTransitThb ?? 0}</span>
              </li>
            </ul>
            <p className="mt-2 text-slate-600">
              Итого с гостя (на сайте):{' '}
              <strong className="text-slate-900">฿{split.guestTotalThb ?? 0}</strong>
            </p>
          </div>

          {display.lines?.length > 0 && (
            <div>
              <p className="font-medium mb-2" style={{ color: NAVY }}>
                Позиции чека
              </p>
              <ul className="space-y-2">
                {display.lines.map((line, i) => (
                  <li key={i} className="rounded-lg border p-3 bg-slate-50">
                    <p className="font-medium">{line.name}</p>
                    <p className="text-slate-600 mt-1">
                      Сумма: <strong>฿{line.sumThb}</strong>
                      {line.agentSign !== '—' && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {line.agentSign}
                        </Badge>
                      )}
                    </p>
                    {(line.supplierName || line.supplierInn) && (
                      <p className="text-xs text-slate-500 mt-1">
                        Поставщик: {line.supplierName} · ИНН {line.supplierInn}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-teal-700 font-medium">Технический JSON (для разработки)</summary>
            <pre className="mt-2 bg-slate-900 text-teal-100 p-3 rounded-lg overflow-auto max-h-48">
              {JSON.stringify(display.rawPayload, null, 2)}
            </pre>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  )
}
