'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  MinusCircle,
  Play,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { postLegalTestFullPackage } from '@/lib/admin/admin-fintech-api-client'

const STATUS_STYLES = {
  green: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/70',
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
    dot: 'bg-emerald-500',
  },
  yellow: {
    border: 'border-amber-200',
    bg: 'bg-amber-50/70',
    icon: MinusCircle,
    iconClass: 'text-amber-600',
    dot: 'bg-amber-500',
  },
  red: {
    border: 'border-red-200',
    bg: 'bg-red-50/70',
    icon: XCircle,
    iconClass: 'text-red-600',
    dot: 'bg-red-500',
  },
}

/**
 * Stage 125.8 — Pre-Live Readiness: Фаза 1 hardening + ops + smoke/cron actions.
 */
export function PreLiveReadinessCard({ preLiveReadiness, cronHealth, onRefresh }) {
  const { toast } = useToast()
  const [smokeBusy, setSmokeBusy] = useState(false)
  const [smokeOpen, setSmokeOpen] = useState(false)
  const [smokeResult, setSmokeResult] = useState(null)

  if (!preLiveReadiness) return null

  const { sections = [], allReady, phase1CodeReady, opsRequiredReady, summary, phase1Closed } =
    preLiveReadiness
  const badgeOk = allReady
  const badgePartial = phase1CodeReady && !opsRequiredReady
  const cronJobs = cronHealth?.jobs || []
  const cronStaleCount = cronJobs.filter((j) => j.stale || j.lastStatus === 'error').length
  const cronOkCount = cronJobs.filter((j) => !j.stale && j.lastStatus !== 'error').length

  const runSmoke = async () => {
    setSmokeBusy(true)
    setSmokeResult(null)
    try {
      const { ok, data, json } = await postLegalTestFullPackage({ rail: 'all' })
      setSmokeResult(data || { ok: false, steps: [] })
      setSmokeOpen(true)
      if (!ok) {
        throw new Error(data?.message || json.error || 'Проверка не пройдена')
      }
      toast({
        title: 'Smoke пройден',
        description: 'Цепочка от оплаты до выплат работает на тестовых данных.',
      })
      onRefresh?.()
    } catch (e) {
      setSmokeOpen(true)
      toast({ title: 'Smoke: есть ошибки', description: e.message, variant: 'destructive' })
      onRefresh?.()
    } finally {
      setSmokeBusy(false)
    }
  }

  const scrollToCronHealth = () => {
    document.getElementById('fintech-cron-health')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <>
      <Card
        id="pre-live-readiness"
        className={cn(
          'border-2 shadow-md',
          badgeOk
            ? 'border-emerald-300 bg-gradient-to-br from-emerald-50/40 to-white'
            : badgePartial
              ? 'border-sky-300 bg-gradient-to-br from-sky-50/40 to-white'
              : 'border-amber-300 bg-gradient-to-br from-amber-50/40 to-white',
        )}
      >
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl sm:text-2xl flex items-center gap-2 text-slate-900">
                <ShieldCheck className="h-7 w-7 text-brand-hover shrink-0" />
                Pre-Live Readiness
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-sm text-slate-700 leading-relaxed">
                {phase1Closed
                  ? 'Фаза 1 (Pre-Live Hardening) закрыта в коде — Stages 125.0–125.7. '
                  : 'Фаза 1 (Stages 125.0–125.7): '}
                Защита в коде + операционные проверки перед первым реальным платежом. Чек-лист:{' '}
                <span className="font-medium text-slate-800">docs/PRE_REAL_PAYMENTS_CHECKLIST.md</span>
                {' · '}
                <Link href="/admin/settings/legal" className="text-brand-hover underline font-medium">
                  юридические документы
                </Link>
              </CardDescription>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {phase1Closed && (
                <Badge className="bg-slate-700 hover:bg-slate-700 text-xs">Фаза 1 закрыта</Badge>
              )}
              <Badge
                className={cn(
                  'text-sm px-3 py-1',
                  badgeOk
                    ? 'bg-emerald-600 hover:bg-emerald-600'
                    : badgePartial
                      ? 'bg-sky-600 hover:bg-sky-600'
                      : 'bg-amber-600 hover:bg-amber-600',
                )}
              >
                {badgeOk
                  ? 'Готовы к controlled live'
                  : badgePartial
                    ? 'Код готов — доделать env/staging'
                    : 'Есть блокеры'}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-8">
          {sections.map((section) => (
            <div key={section.id} className="space-y-3">
              <div>
                <h3 className="font-semibold text-slate-900 text-base">{section.title}</h3>
                {section.description && (
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{section.description}</p>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {(section.items || []).map((row) => {
                  const st = STATUS_STYLES[row.status] || STATUS_STYLES.red
                  const Icon = st.icon
                  return (
                    <div
                      key={row.id}
                      className={cn(
                        'rounded-lg border px-3 py-2.5 flex gap-2.5 min-h-[72px]',
                        st.border,
                        st.bg,
                      )}
                    >
                      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', st.iconClass)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn('h-2 w-2 rounded-full shrink-0', st.dot)} />
                          <p className="font-medium text-slate-900 text-xs leading-tight">{row.label}</p>
                        </div>
                        <p className="text-[11px] text-slate-600 mt-1 leading-snug">{row.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="rounded-xl border-2 border-dashed border-brand/30 bg-brand/10 p-4 space-y-3">
            <p className="font-semibold text-brand text-sm">Быстрые проверки перед live</p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                className="border-brand text-brand hover:bg-brand/15"
                disabled={smokeBusy}
                onClick={runSmoke}
              >
                {smokeBusy ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Запустить полный smoke
              </Button>
              <Button type="button" variant="outline" onClick={scrollToCronHealth}>
                <Clock className="h-4 w-4 mr-2" />
                Проверить Cron Health
                {cronJobs.length > 0 && (
                  <span className="ml-1.5 text-xs opacity-80">
                    ({cronOkCount}/{cronJobs.length} OK)
                  </span>
                )}
              </Button>
              <Button type="button" variant="ghost" disabled={smokeBusy} onClick={() => onRefresh?.()}>
                Обновить статусы
              </Button>
            </div>
            {cronStaleCount > 0 && (
              <p className="text-xs text-amber-900">
                Cron: {cronStaleCount} задач требуют внимания — см. панель ниже или{' '}
                docs/CRON_EXTERNAL_FINANCIAL.md
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 border-t pt-4">
            <span>
              Операционно: {summary?.opsGreen ?? 0} зелёных · {summary?.opsYellow ?? 0} внимание ·{' '}
              {summary?.opsRed ?? 0} блокеров
            </span>
            <span>
              Обновлено:{' '}
              {preLiveReadiness.generatedAt
                ? new Date(preLiveReadiness.generatedAt).toLocaleString('ru-RU')
                : '—'}
            </span>
            <span className="inline-flex items-center gap-1 text-brand-hover">
              <ExternalLink className="h-3 w-3" />
              Go/No-Go: docs/GO_NO_GO_FIRST_REAL_PAYMENT.md
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={smokeOpen} onOpenChange={setSmokeOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Результат smoke (Pre-Live)</DialogTitle>
            <DialogDescription>
              {smokeResult?.ok
                ? 'Все шаги пройдены — цепочка работает.'
                : 'Есть ошибки — сохраните скрин и покажите разработчику.'}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-2 text-sm">
            {(smokeResult?.steps || []).map((s, i) => (
              <li
                key={s.id || i}
                className={cn(
                  'flex gap-2 rounded-md px-2 py-1',
                  s.ok ? 'text-emerald-900 bg-emerald-50' : 'text-red-900 bg-red-50',
                )}
              >
                {s.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
                <span>
                  <strong>{s.label || s.id}</strong>
                  {s.detail ? ` — ${s.detail}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  )
}
