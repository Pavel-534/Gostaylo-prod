'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Radio,
  Wallet,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { patchFintechTreasuryOps } from '@/lib/admin/admin-fintech-api-client'

function metricCard(label, value, detail, ok = true) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5 min-h-[72px]',
        ok ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70',
      )}
    >
      <p className="text-[11px] font-medium text-slate-600 uppercase tracking-wide">{label}</p>
      <p className="text-xl font-bold text-slate-900 mt-0.5">{value}</p>
      {detail && <p className="text-[11px] text-slate-600 mt-1">{detail}</p>}
    </div>
  )
}

/**
 * Stage 126.0 — Controlled Live launch + live monitoring metrics.
 */
export function ControlledLivePanel({ liveMonitoring, treasuryOps, onRefresh }) {
  const { toast } = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const cl = liveMonitoring?.controlledLive || treasuryOps?.controlledLive
  const active = Boolean(cl?.active)
  const metrics = liveMonitoring || {}
  const drift = Number(metrics.driftThb) || 0
  const driftOk = drift <= 0.5

  const activateLive = async () => {
    setBusy(true)
    setConfirmOpen(false)
    try {
      const { ok, json } = await patchFintechTreasuryOps({
        activateControlledLive: true,
        reason: 'Владелец активировал Controlled Live через FinTech-пульт',
      })
      if (!ok) {
        throw new Error(json?.message || json?.error || 'Не удалось активировать Live Mode')
      }
      toast({
        title: 'Controlled Live включён',
        description: 'Concierge-режим подтверждён. Уведомление отправлено в TG FINANCE.',
      })
      onRefresh?.()
    } catch (e) {
      toast({ title: 'Ошибка', description: e.message, variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card
        id="controlled-live-panel"
        className={cn(
          'border-2 shadow-md',
          active
            ? 'border-violet-400 bg-gradient-to-br from-violet-50/50 to-white'
            : 'border-slate-300 bg-white',
        )}
      >
        <CardHeader className="pb-3">
          {active ? (
            <div className="mb-4 rounded-lg border-2 border-emerald-400 bg-emerald-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-emerald-900 tracking-wide flex items-center gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                CONTROLLED LIVE: ACTIVE
              </p>
              <p className="text-sm text-emerald-800 tabular-nums">
                24ч: {metrics.payments24h ?? 0} · 7д: {metrics.payments7d ?? 0} · escrow:{' '}
                {metrics.paidEscrowAwaitingThaw ?? 0} · drift: ฿{drift.toFixed(2)}
              </p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl flex items-center gap-2 text-slate-900">
                <Radio className={cn('h-6 w-6', active ? 'text-violet-600' : 'text-slate-500')} />
                Controlled Live — мониторинг
              </CardTitle>
              <CardDescription className="mt-2 max-w-2xl text-sm">
                {active
                  ? `Live с ${cl?.startedAt ? new Date(cl.startedAt).toLocaleString('ru-RU') : '—'}. Ручные выплаты (Concierge) включены.`
                  : 'После Go/No-Go активируйте приём реальных платежей. Авто-пулы останутся выключены.'}
                {cl?.firstPaymentBookingId && (
                  <span className="block mt-1 text-violet-800">
                    Первая оплата: {cl.firstPaymentBookingId.slice(0, 12)}…
                  </span>
                )}
              </CardDescription>
            </div>
            {active ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-600">ACTIVE</Badge>
            ) : (
              <Button
                type="button"
                className="bg-violet-700 hover:bg-violet-800"
                disabled={busy}
                onClick={() => setConfirmOpen(true)}
              >
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Wallet className="h-4 w-4 mr-2" />}
                Перейти в Live Mode
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {metricCard(
              'Оплаты 24ч',
              metrics.payments24h ?? '—',
              'не-smoke, post-escrow',
              (metrics.payments24h ?? 0) >= 0,
            )}
            {metricCard('Оплаты 7д', metrics.payments7d ?? '—', 'не-smoke, post-escrow')}
            {metricCard(
              'PAID_ESCROW (ждут thaw)',
              metrics.paidEscrowAwaitingThaw ?? '—',
              'деньги в эскроу',
              (metrics.paidEscrowAwaitingThaw ?? 0) < 20,
            )}
            {metricCard(
              'Ledger drift',
              `฿${drift.toFixed(2)}`,
              driftOk ? 'в норме' : 'разберитесь до выплат',
              driftOk,
            )}
            {metricCard(
              'Webhook errors 7д',
              metrics.webhookErrors7d ?? 0,
              'payments/confirm',
              (metrics.webhookErrors7d ?? 0) === 0,
            )}
            {metricCard(
              'Treasury alerts 7д',
              metrics.treasuryErrors7d ?? 0,
              'drift / fiscal / webhook',
              (metrics.treasuryErrors7d ?? 0) < 3,
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
              <Link href="/admin/finance/intelligence">
                Financial Intelligence
                <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </Button>
            <span className="text-xs text-slate-500">
              FI → пресет «Real Payments Only», P&amp;L по клику
            </span>
          </div>

          <p className="text-xs text-slate-500 flex items-center gap-1">
            <Activity className="h-3.5 w-3.5" />
            Обновлено:{' '}
            {metrics.generatedAt ? new Date(metrics.generatedAt).toLocaleString('ru-RU') : '—'}
            {' · '}
            Runbook: docs/CONTROLLED_LIVE_RUNBOOK.md
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              Перейти в Controlled Live?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <p>Будет выполнено:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    <strong>TREASURY_MANUAL_MODE = 1</strong> — выплаты только вручную (Concierge)
                  </li>
                  <li>Запись в журнал + уведомление в <strong>TG FINANCE</strong></li>
                  <li>Алерт при <strong>первой реальной оплате</strong> (не smoke)</li>
                </ul>
                <p className="pt-2 font-medium text-foreground">
                  Убедитесь: Pre-Live Readiness зелёный, Emergency Pause выключен, ЮKassa и касса настроены.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-violet-700 hover:bg-violet-800"
              onClick={activateLive}
              disabled={busy}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Да, включить Live Mode
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
