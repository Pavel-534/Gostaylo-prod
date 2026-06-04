'use client'

import { CreditCard, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Stage 130.4 — YooKassa status + recent MIR intents (ops fields).
 */
export function YookassaOpsCard({ yookassaOps }) {
  if (!yookassaOps) return null

  const configured = yookassaOps.configured === true
  const intents = Array.isArray(yookassaOps.recentIntents) ? yookassaOps.recentIntents : []
  const cl = yookassaOps.controlledLive || {}

  return (
    <Card
      className={cn(
        'border shadow-sm',
        configured ? 'border-emerald-200 bg-emerald-50/30' : 'border-amber-200 bg-amber-50/40',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900">
              <CreditCard className="h-5 w-5 text-brand-hover" />
              YooKassa Status
            </CardTitle>
            <CardDescription className="mt-1">
              Acquirer MIR/RUB · Fiscal A (чек post-escrow). API:{' '}
              <code className="text-xs">{yookassaOps.apiBase || '—'}</code>
            </CardDescription>
          </div>
          <Badge className={configured ? 'bg-emerald-600' : 'bg-amber-600'}>
            {configured ? 'Configured' : 'Not configured'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-2 text-slate-700">
          <p>
            Adapter: <strong>{yookassaOps.adapterMode || '—'}</strong>
          </p>
          <p>
            Webhook IP enforce:{' '}
            <strong>{yookassaOps.webhookIpEnforce ? 'ON' : 'OFF'}</strong>
          </p>
          <p>
            Controlled Live:{' '}
            <strong>{cl.controlledLiveActive ? 'ACTIVE' : 'off'}</strong>
          </p>
          <p>
            Pilot limit ฿/day:{' '}
            <strong>{cl.maxThbPerDay > 0 ? cl.maxThbPerDay.toLocaleString('ru-RU') : '∞'}</strong>
          </p>
        </div>

        {!configured && (yookassaOps.missingEnv || []).length > 0 && (
          <p className="text-xs text-amber-900 rounded-lg border border-amber-200 bg-amber-100/80 px-3 py-2">
            Env: {(yookassaOps.missingEnv || []).join(', ')}
          </p>
        )}

        <div>
          <p className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Recent MIR intents
          </p>
          {intents.length === 0 ? (
            <p className="text-xs text-slate-500">Нет недавних payment_intents (MIR_RU).</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-left">
                  <tr>
                    <th className="px-2 py-2">Intent</th>
                    <th className="px-2 py-2">Booking</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">payment_id</th>
                    <th className="px-2 py-2">test</th>
                    <th className="px-2 py-2">idem</th>
                  </tr>
                </thead>
                <tbody>
                  {intents.map((row) => (
                    <tr key={row.intentId} className="border-t border-slate-100">
                      <td className="px-2 py-1.5 font-mono">{row.intentId}</td>
                      <td className="px-2 py-1.5 font-mono">{row.bookingId}</td>
                      <td className="px-2 py-1.5">{row.status}</td>
                      <td className="px-2 py-1.5 font-mono max-w-[140px] truncate" title={row.yookassaPaymentId || ''}>
                        {row.yookassaPaymentId || row.externalRef || '—'}
                      </td>
                      <td className="px-2 py-1.5">
                        {row.yookassaTest === true ? '✓' : row.yookassaTest === false ? '—' : '?'}
                      </td>
                      <td className="px-2 py-1.5 font-mono max-w-[100px] truncate" title={row.yookassaIdempotenceKey || ''}>
                        {row.yookassaIdempotenceKey ? `${row.yookassaIdempotenceKey.slice(0, 8)}…` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-500 border-t pt-2">
          Webhook URL: <code>/api/webhooks/payments/confirm</code> · Test card E2E — ручной staging (см. PRE_REAL_PAYMENTS §E0).
        </p>
      </CardContent>
    </Card>
  )
}
