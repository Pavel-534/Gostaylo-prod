'use client'

import { CheckCircle2, Shield, XCircle, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

/**
 * Stage 106.1 — «Готовность к продакшену» (P0 payment hardening).
 */
export function FinTechProductionReadinessCard({ readiness }) {
  if (!readiness) return null

  const items = readiness.items || []
  const allOk = readiness.allRequiredReady === true

  return (
    <Card
      className={cn(
        'border-2 shadow-md',
        allOk ? 'border-emerald-300 bg-emerald-50/40' : 'border-amber-400 bg-amber-50/50',
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl flex items-center gap-2 text-slate-900">
              <Shield className="h-6 w-6 text-brand-hover" />
              Готовность к продакшену
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              P0-барьер перед реальными платежами: ключи ЮKassa, webhook, касса, treasury и блокировка
              client-side confirm. Обновлено:{' '}
              {readiness.generatedAt
                ? new Date(readiness.generatedAt).toLocaleString('ru-RU')
                : '—'}
            </CardDescription>
          </div>
          <Badge
            variant={allOk ? 'default' : 'destructive'}
            className={cn('text-sm px-3 py-1', allOk && 'bg-emerald-600 hover:bg-emerald-600')}
          >
            {allOk ? 'Обязательные проверки OK' : 'Есть блокеры'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {readiness.productionEnvironment === false && (
          <div className="rounded-lg border border-amber-200 bg-amber-100/80 px-4 py-3 text-sm text-amber-950 flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <p>
              Среда не помечена как production — жёсткий P0-guard активен только при{' '}
              <code className="text-xs">VERCEL_ENV=production</code>,{' '}
              <code className="text-xs">NODE_ENV=production</code> или{' '}
              <code className="text-xs">PAYMENT_PRODUCTION_HARDENING=1</code>.
            </p>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'rounded-xl border px-4 py-3 flex gap-3',
                item.ready ? 'border-emerald-200 bg-white' : 'border-red-200 bg-white',
              )}
            >
              {item.ready ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 text-sm">{item.label}</p>
                <p className="text-xs text-slate-600 mt-0.5 break-words">{item.detail}</p>
                {item.severity === 'recommended' && (
                  <span className="text-[10px] uppercase tracking-wide text-slate-400 mt-1 inline-block">
                    рекомендация
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 border-t pt-3">
          ЮKassa IP allowlist на webhook включается на production автоматически (отключить:{' '}
          <code>YOOKASSA_WEBHOOK_ENFORCE_IP=0</code>). Mock acquiring только вне production.
        </p>
      </CardContent>
    </Card>
  )
}
