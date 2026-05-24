'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Download,
  FileStack,
  Globe,
  Loader2,
  Play,
  Scale,
  Timer,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fmtThb, FINTECH_NAVY } from '@/lib/admin/fintech-console-shared'

const NAVY = FINTECH_NAVY

function StatusTile({ title, count, thb, icon: Icon, accent, sub }) {
  const border =
    accent === 'blue'
      ? 'border-blue-200 bg-blue-50/50'
      : accent === 'violet'
        ? 'border-violet-200 bg-violet-50/50'
        : accent === 'amber'
          ? 'border-amber-200 bg-amber-50/50'
          : accent === 'red'
            ? 'border-red-200 bg-red-50/50'
            : 'border-emerald-200 bg-emerald-50/50'

  return (
    <div className={cn('rounded-xl border p-4', border)}>
      <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <p className="text-2xl font-bold mt-2 text-slate-900">{count}</p>
      <p className="text-sm font-medium text-brand-hover">{fmtThb(thb)}</p>
      {sub ? <p className="text-[11px] text-muted-foreground mt-1">{sub}</p> : null}
    </div>
  )
}

export function FinTechTreasuryHeroDashboard({ dash, statCards, onSimulateRail, ownerMode = true }) {
  const [simBusy, setSimBusy] = useState(null)

  const rub = dash?.rails?.TBANK_RU
  const intl = dash?.rails?.KG_CRYPTO
  const awaiting = dash?.awaitingConversion
  const driftThb = Math.abs(Number(dash?.alerts?.ledgerDriftThb) || 0)
  const driftBad = driftThb > 0.01

  const runSim = async (rail) => {
    if (!onSimulateRail) return
    setSimBusy(rail)
    try {
      await onSimulateRail(rail)
    } finally {
      setSimBusy(null)
    }
  }

  const treasuryHero = [
    {
      key: 'ready',
      label: 'Готово к выплате (всего)',
      value: dash?.payout?.readyForPayoutCount ?? 0,
      sub: fmtThb(dash?.payout?.readyForPayoutThb),
      hint: ownerMode ? 'готово к переводу в банк' : 'броней READY_FOR_PAYOUT',
      icon: Banknote,
      accent: 'teal',
    },
    {
      key: 'acts',
      label: 'Ожидает актов',
      value: dash?.treasury?.awaitingActsLines ?? 0,
      sub:
        (dash?.treasury?.openBatchesCount ?? 0) > 0
          ? `в ${dash.treasury.openBatchesCount} открытом пуле`
          : 'нет открытых пулов',
      hint: 'до закрытия пула',
      icon: FileStack,
      accent: 'amber',
    },
    {
      key: 'zip',
      label: 'Последний ZIP',
      value: dash?.treasury?.lastSettledBatch?.partnerActsCount ?? 0,
      sub: dash?.treasury?.lastSettledBatch?.settledAt
        ? new Date(dash.treasury.lastSettledBatch.settledAt).toLocaleDateString('ru-RU')
        : 'ещё не закрывали',
      hint: dash?.treasury?.lastSettledBatch?.id
        ? `пул ${String(dash.treasury.lastSettledBatch.id).slice(0, 14)}…`
        : '',
      icon: CheckCircle2,
      accent: 'slate',
      batchId: dash?.treasury?.lastSettledBatch?.id,
    },
  ]

  const hasProblems = Boolean(
    dash?.alerts?.fiscalAlert || dash?.alerts?.driftAlert || dash?.alerts?.payoutAlert,
  )

  return (
    <div className="space-y-6">
      <Card className="border-2 border-slate-200 shadow-lg bg-gradient-to-br from-slate-50 to-white">
        <CardContent className="pt-6 pb-5 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-hover">
              Состояние системы
            </p>
            <h2 className="text-2xl font-bold mt-1" style={{ color: NAVY }}>
              Казначейство перед первой выплатой
            </h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
              {ownerMode
                ? 'Два направления выплат: в рублях по России и международные (USDT). Пакеты для банка формируются отдельно.'
                : 'Два рельса: RUB Direct (партнёры RUB) и KG / USDT (международные). Пулы и ZIP — отдельно по рельсу.'}
            </p>
          </div>

          <div
            className={cn(
              'grid sm:grid-cols-2 gap-3',
              ownerMode && !driftBad ? 'lg:grid-cols-3' : 'lg:grid-cols-4',
            )}
          >
            <StatusTile
              title={ownerMode ? 'Выплаты в ₽' : 'RUB Direct'}
              count={rub?.readyCount ?? 0}
              thb={rub?.readyThb}
              icon={Banknote}
              accent="blue"
            />
            <StatusTile
              title={ownerMode ? 'Международные' : 'KG / USDT'}
              count={intl?.readyCount ?? 0}
              thb={intl?.readyThb}
              icon={Globe}
              accent="violet"
            />
            <StatusTile
              title="Ожидает 24ч"
              count={awaiting?.count ?? 0}
              thb={awaiting?.thb}
              icon={Timer}
              accent="amber"
              sub="hold после разморозки"
            />
            {!ownerMode ? (
              <StatusTile
                title="Drift ledger"
                count={driftBad ? '!' : 'OK'}
                thb={driftThb}
                icon={Scale}
                accent={driftBad ? 'red' : 'emerald'}
                sub={driftBad ? 'сверьте книгу' : 'в норме'}
              />
            ) : driftBad ? (
              <StatusTile
                title="Сверка учёта"
                count="!"
                thb={driftThb}
                icon={Scale}
                accent="red"
                sub="нужна проверка"
              />
            ) : null}
          </div>

          {onSimulateRail ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="lg"
                className="bg-blue-700 hover:bg-blue-800"
                disabled={Boolean(simBusy)}
                onClick={() => runSim('TBANK_RU')}
              >
                {simBusy === 'TBANK_RU' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Симулировать RUB Direct
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-violet-300 text-violet-900"
                disabled={Boolean(simBusy)}
                onClick={() => runSim('KG_CRYPTO')}
              >
                {simBusy === 'KG_CRYPTO' ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Симулировать KG / USDT
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/settings/legal">Отчёт в Legal</Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {hasProblems ? (
        <Card
          className={cn(
            'border-2 shadow-md',
            dash?.alerts?.driftAlert || dash?.alerts?.fiscalAlert
              ? 'border-red-300 bg-red-50'
              : 'border-amber-300 bg-amber-50',
          )}
        >
          <CardContent className="py-4 flex flex-wrap items-start gap-3">
            <AlertTriangle className="h-6 w-6 shrink-0 text-red-600" />
            <div className="text-sm space-y-2 flex-1 min-w-[200px]">
              <p className="font-semibold text-lg text-red-950">Нужно внимание перед выплатой</p>
              {dash?.alerts?.fiscalAlert ? (
                <p className="text-red-900/90">
                  Онлайн-касса: {dash.alerts.pendingFiscalCount} броней без чека.
                </p>
              ) : null}
              {dash?.alerts?.driftAlert ? (
                <p className="text-red-900/90">
                  Книга учёта: расхождение {fmtThb(dash.alerts.ledgerDriftThb)}.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid md:grid-cols-3 gap-4">
        {treasuryHero.map(({ key, label, value, sub, hint, icon: Icon, accent, batchId }) => (
          <Card
            key={key}
            className={cn(
              'shadow-lg border-2',
              accent === 'teal' && 'border-brand/25',
              accent === 'amber' && 'border-amber-200',
              accent === 'slate' && 'border-slate-200',
            )}
          >
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Icon className="h-5 w-5 text-brand" />
                {label}
              </div>
              <p className="text-4xl font-bold mt-2 tracking-tight" style={{ color: NAVY }}>
                {value}
              </p>
              <p className="text-lg font-medium text-brand-hover mt-1">{sub}</p>
              <p className="text-xs text-muted-foreground mt-2">{hint}</p>
              {batchId ? (
                <Button variant="outline" size="sm" className="mt-3" asChild>
                  <a
                    href={`/api/admin/finances/payout-batches/${batchId}/bank-package`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Скачать ZIP
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      {statCards?.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {statCards.map(({ label, value, sub, icon: Icon, danger }) => (
            <div key={label} className="rounded-xl border bg-white px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500 text-xs font-medium">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className={cn('text-lg font-bold mt-1', danger && 'text-red-600')}>
                {value}
              </div>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
