'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BarChart3, Download, Gift, Loader2, PiggyBank, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  fetchReferralLiabilitySnapshot,
  patchReferralLedgerAdmin,
  postReferralLedgerBulk,
  referralLedgerExportUrl,
} from '@/lib/admin/admin-fintech-api-client'
import { ReferralPayoutWorkflowPanel } from '@/components/admin/finances/ReferralPayoutWorkflowPanel'
import { ReferralMonthlySpendBar } from '@/components/admin/finances/ReferralMonthlySpendBar'
import { fmtThb } from '@/lib/admin/fintech-console-shared'

function StatTile({ label, value, hint, tone = 'slate' }) {
  const toneClass =
    tone === 'violet'
      ? 'border-violet-200 bg-violet-50/80 text-violet-950'
      : tone === 'teal'
        ? 'border-teal-200 bg-teal-50/80 text-teal-950'
        : tone === 'amber'
          ? 'border-amber-200 bg-amber-50/80 text-amber-950'
          : tone === 'rose'
            ? 'border-rose-200 bg-rose-50/80 text-rose-950'
            : 'border-slate-200 bg-white text-slate-900'
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-2xl font-bold tabular-nums mt-1">{value}</p>
      {hint ? <p className="text-xs mt-1 opacity-80">{hint}</p> : null}
    </div>
  )
}

function AccrualsChart({ series }) {
  const rows = Array.isArray(series) ? series : []
  if (!rows.length) return <p className="text-sm text-slate-500">Нет данных за период.</p>
  const max = Math.max(
    1,
    ...rows.flatMap((r) => [Number(r.earnedThb) || 0, Number(r.payoutRequestsThb) || 0]),
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-violet-500" />
          Начисления (earned)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-teal-500" />
          Заявки на вывод (не банк)
        </span>
      </div>
      <div className="flex items-end gap-2 h-36">
        {rows.map((row) => {
          const earnedH = `${Math.round(((Number(row.earnedThb) || 0) / max) * 100)}%`
          const payoutH = `${Math.round(((Number(row.payoutRequestsThb) || 0) / max) * 100)}%`
          return (
            <div key={row.month} className="flex-1 min-w-[2.5rem] flex flex-col items-center gap-1">
              <div className="flex items-end justify-center gap-0.5 h-28 w-full">
                <div
                  className="w-[42%] rounded-t bg-violet-500/90"
                  style={{ height: earnedH }}
                  title={`earned ${row.earnedThb}`}
                />
                <div
                  className="w-[42%] rounded-t bg-teal-500/90"
                  style={{ height: payoutH }}
                  title={`requests ${row.payoutRequestsThb}`}
                />
              </div>
              <span className="text-[10px] text-slate-500 tabular-nums">{row.month?.slice(5) || row.month}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Stage 114.2 / 114.4 — Referral Liability на FinTech-пульте.
 */
export function ReferralLiabilityPanel({ toast }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState('')
  const [ledgerStatus, setLedgerStatus] = useState('all')
  const [ledgerType, setLedgerType] = useState('all')
  const [actionBusy, setActionBusy] = useState(null)
  const [bulkBusy, setBulkBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { ok, data: snap, error } = await fetchReferralLiabilitySnapshot({
        periodFrom: periodFrom || undefined,
        periodTo: periodTo || undefined,
        status: ledgerStatus,
        type: ledgerType,
        accrualLimit: 25,
        topLimit: 10,
      })
      if (!ok) throw new Error(error || 'REFERRAL_LIABILITY_FAILED')
      setData(snap)
    } catch (e) {
      toast?.({ variant: 'destructive', title: 'Referral Liability', description: e?.message || 'Ошибка' })
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [toast, periodFrom, periodTo, ledgerStatus, ledgerType])

  useEffect(() => {
    void load()
  }, [load])

  const exportHref = useMemo(
    () =>
      referralLedgerExportUrl({
        status: ledgerStatus,
        type: ledgerType,
        dateFrom: periodFrom,
        dateTo: periodTo,
        limit: 3000,
      }),
    [ledgerStatus, ledgerType, periodFrom, periodTo],
  )

  if (loading && !data) {
    return (
      <Card className="border-violet-200">
        <CardContent className="py-10 flex justify-center text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Загрузка Referral Liability…
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  const alert = data.alertPolicy || {}
  const acc = data.accounting || {}

  const runLedgerBulk = async (action) => {
    setBulkBusy(true)
    try {
      const { ok, data, error } = await postReferralLedgerBulk({
        action,
        periodFrom: periodFrom || undefined,
        periodTo: periodTo || undefined,
        type: ledgerType,
      })
      if (!ok) throw new Error(error || 'BULK_LEDGER_FAILED')
      toast?.({
        title: 'Referral ledger',
        description: `${action}: ${data?.processed ?? 0} строк`,
      })
      await load()
    } catch (e) {
      toast?.({ variant: 'destructive', title: 'Referral ledger', description: e?.message || 'Ошибка' })
    } finally {
      setBulkBusy(false)
    }
  }

  const runLedgerAction = async (ledgerId, action) => {
    const key = `${ledgerId}:${action}`
    setActionBusy(key)
    try {
      const { ok, error } = await patchReferralLedgerAdmin(ledgerId, { action })
      if (!ok) throw new Error(error || 'LEDGER_ACTION_FAILED')
      toast?.({ title: 'Referral ledger', description: `${action} OK` })
      await load()
    } catch (e) {
      toast?.({ variant: 'destructive', title: 'Referral ledger', description: e?.message || 'Ошибка' })
    } finally {
      setActionBusy(null)
    }
  }

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50/90 to-white shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-violet-950">
              <Gift className="h-5 w-5" />
              Referral Liability
            </CardTitle>
            <CardDescription>
              Бухгалтерский снимок: earned, liability, promo tank, net marketing cost. SSOT: docs/REFERRAL_ACCOUNTING.md
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Обновить
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={exportHref} download>
                <Download className="h-4 w-4 mr-1" />
                CSV ledger
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <Link href="/admin/marketing/payouts?referralOnly=1">Кошельки к выплате</Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {acc?.totalEarnedThb != null ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <StatTile label="Total earned" value={fmtThb(acc.totalEarnedThb)} tone="violet" />
            <StatTile
              label="Total withdrawn"
              value={fmtThb(acc.totalWithdrawnThb)}
              hint="Дебеты wallet (referral payout)"
              tone="teal"
            />
            <StatTile
              label="Current liability"
              value={fmtThb(acc.currentLiabilityThb)}
              hint={`Exposure: ${fmtThb(acc.walletExposureThb)}`}
              tone="rose"
            />
            <StatTile
              label="Promo tank usage"
              value={fmtThb(acc.promoTankUsageThb)}
              hint={`Баланс: ${fmtThb(acc.promoTankBalanceThb)}`}
              tone="amber"
            />
            <StatTile
              label="Net marketing cost"
              value={fmtThb(acc.netMarketingCostThb)}
              hint={`Месяц earned: ${fmtThb(acc.monthlyEarnedThb)}`}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Период с</Label>
            <Input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Период по</Label>
            <Input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Статус ledger</Label>
            <Select value={ledgerStatus} onValueChange={setLedgerStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="earned">earned</SelectItem>
                <SelectItem value="pending">pending</SelectItem>
                <SelectItem value="canceled">canceled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Тип</Label>
            <Select value={ledgerType} onValueChange={setLedgerType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="bonus">bonus</SelectItem>
                <SelectItem value="cashback">cashback</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" className="w-full" onClick={() => void load()} disabled={loading}>
              Применить
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkBusy || loading}
            onClick={() => void runLedgerBulk('hold_all_pending')}
          >
            Hold all pending (фильтр)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkBusy || loading}
            onClick={() => void runLedgerBulk('release_all_held')}
          >
            Release all held
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile
            label="Ledger earned (журнал)"
            value={fmtThb(data.referralLiabilityLedgerThb)}
            hint="Сумма earned в referral_ledger"
            tone="violet"
          />
          <StatTile
            label="В кошельках (withdrawable)"
            value={fmtThb(data.earnedInWalletsWithdrawableThb ?? data.walletWithdrawableTotalThb)}
            hint="Потенциальный исходящий cash"
            tone="teal"
          />
          <StatTile
            label="Разрыв ledger ↔ wallet"
            value={fmtThb(data.ledgerVsWalletGapThb)}
            hint={`Internal: ${fmtThb(data.walletInternalTotalThb)}`}
            tone="rose"
          />
          <StatTile
            label="Promo Tank"
            value={fmtThb(data.marketingPromoPotThb)}
            hint={`Дебеты: ${fmtThb(data.promoTankDebitsThb)}`}
            tone="amber"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile label="Pending в ledger" value={fmtThb(data.ledgerPendingTotalThb)} hint="Ещё не earned" />
          <StatTile
            label="Заявки withdrawable_referral"
            value={fmtThb(data.pendingReferralPayoutTotalThb)}
            hint={`${data.pendingReferralPayoutRequests} заявок`}
          />
          <StatTile
            label="Прогноз host activation"
            value={fmtThb(data.forecastHostActivationDebitThb)}
            hint="След. 10 активаций"
          />
          <StatTile
            label="Алерты админа"
            value={`≥ ${fmtThb(alert.largeEarnAlertThb)}`}
            hint={`Месяц: ≥ ${fmtThb(alert.monthlySpendAlertThb)} · burst/ч: ${fmtThb(alert.hourlyBurstAlertThb)}`}
          />
        </div>

        {acc?.monthlyEarnedThb != null ? <ReferralMonthlySpendBar accounting={acc} /> : null}

        {Array.isArray(acc?.heldRows) && acc.heldRows.length > 0 ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-3 text-sm text-amber-950">
            <p className="font-semibold mb-1">На hold ({acc.heldCount})</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {acc.heldRows.map((h) => (
                <li key={h.id}>
                  {h.id} · {fmtThb(h.amountThb)} · бронь {h.bookingId}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-violet-600" />
              Начисления vs заявки на вывод (6 мес.)
            </p>
            <AccrualsChart series={data.accrualsVsPayouts} />
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-violet-600" />
              Promo Tank
            </p>
            <p className="text-sm text-slate-600 mt-2">
              Topups за период: <span className="font-semibold tabular-nums">{fmtThb(data.promoTankTopupsThb)}</span>
            </p>
            <p className="text-sm text-slate-600 mt-1">
              Прогноз дебета (10 host):{' '}
              <span className="font-semibold tabular-nums">{fmtThb(data.forecastHostActivationDebitThb)}</span>
            </p>
            <p className="text-xs text-slate-500 mt-3">
              Баланс tank не должен уходить в минус без явного topup — контролируйте дебеты vs topups.
            </p>
          </div>
        </div>

        {Array.isArray(data.topAmbassadors) && data.topAmbassadors.length > 0 ? (
          <div>
            <p className="text-sm font-semibold mb-2 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Топ амбассадоров (earned за период)
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-slate-600">
                    <th className="p-2 font-medium">#</th>
                    <th className="p-2 font-medium">Амбассадор</th>
                    <th className="p-2 font-medium">Earned THB</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topAmbassadors.map((row) => (
                    <tr key={row.referrerId} className="border-b last:border-0">
                      <td className="p-2 text-slate-500">{row.rank}</td>
                      <td className="p-2">
                        {row.name || row.email || row.referrerId}
                        {row.email ? (
                          <span className="block text-xs text-slate-500">{row.email}</span>
                        ) : null}
                      </td>
                      <td className="p-2 tabular-nums font-medium text-violet-800">{fmtThb(row.earnedThb)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <PiggyBank className="h-4 w-4 text-teal-600" />
              Очередь вывода реферальных
            </p>
            <p className="text-sm text-slate-700 tabular-nums">
              {data.pendingReferralPayoutRequests} заявок · {fmtThb(data.pendingReferralPayoutTotalThb)} THB
            </p>
          </div>
          <ReferralPayoutWorkflowPanel
            payoutQueue={data.payoutQueue}
            toast={toast}
            onRefresh={load}
          />
          <p className="text-xs text-slate-500">
            SSOT: <code>docs/REFERRAL_ACCOUNTING.md</code> · полуавтомат, без автобанка.
          </p>
        </div>

        {Array.isArray(data.accruals) && data.accruals.length > 0 ? (
          <div>
            <p className="text-sm font-semibold mb-2">Последние строки ledger (фильтр)</p>
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white max-h-56 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="border-b text-left text-slate-600">
                    <th className="p-2 font-medium">Дата</th>
                    <th className="p-2 font-medium">Сумма</th>
                    <th className="p-2 font-medium">Статус</th>
                    <th className="p-2 font-medium">Тип</th>
                    <th className="p-2 font-medium">Referrer</th>
                    <th className="p-2 font-medium">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accruals.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-2 text-slate-500 whitespace-nowrap">
                        {row.earnedAt ? new Date(row.earnedAt).toLocaleString('ru-RU') : '—'}
                      </td>
                      <td className="p-2 tabular-nums font-medium text-violet-800">+{fmtThb(row.amountThb)}</td>
                      <td className="p-2">{row.status}</td>
                      <td className="p-2">
                        {row.type} / {row.referralType}
                        {row.ledgerDepth != null ? ` L${row.ledgerDepth}` : ''}
                      </td>
                      <td className="p-2 text-xs">{row.referrerEmail || row.referrerId}</td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1">
                          {row.status === 'pending' ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                disabled={!!actionBusy}
                                onClick={() => void runLedgerAction(row.id, 'hold')}
                              >
                                Hold
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-7 text-xs"
                                disabled={!!actionBusy}
                                onClick={() => void runLedgerAction(row.id, 'reject')}
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                          {row.status === 'earned' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              className="h-7 text-xs"
                              disabled={!!actionBusy}
                              onClick={() => void runLedgerAction(row.id, 'reject')}
                            >
                              Clawback
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
