'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Calculator, Loader2, AlertTriangle, Info } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { AmbassadorOwnerWaterfallBar } from '@/components/admin/finances/FinTechMarginBar'
import { fmtThb } from '@/lib/admin/fintech-console-shared'
import { fetchFintechSettings } from '@/lib/admin/admin-fintech-api-client'
import { fetchAdminSettings } from '@/lib/admin/admin-settings-api-client'
import {
  computeLaunchPromoPlan,
  fintechSettingsToPolicy,
  LAUNCH_PLANNER_REINVESTMENT_MAX,
  LAUNCH_PLANNER_REINVESTMENT_MIN,
  LAUNCH_PLANNER_SUBTOTAL_MAX,
  LAUNCH_PLANNER_SUBTOTAL_MIN,
  normalizePlannerInputs,
} from '@/lib/admin/launch-promo-planner.js'
import { cn } from '@/lib/utils'

const PRESET_CHECKS = [1_000, 3_000, 10_000, 35_000]

function MetricRow({ label, value, hint, tone = 'neutral' }) {
  const toneClass =
    tone === 'warn'
      ? 'text-amber-900'
      : tone === 'good'
        ? 'text-emerald-900'
        : tone === 'muted'
          ? 'text-slate-600'
          : 'text-slate-900'
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2 border-b border-slate-100 last:border-0">
      <div>
        <p className={cn('text-sm font-medium', toneClass)}>{label}</p>
        {hint ? <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p> : null}
      </div>
      <p className={cn('text-sm font-semibold tabular-nums', toneClass)}>{value}</p>
    </div>
  )
}

export function LaunchPromoCalculatorPanel() {
  const [loading, setLoading] = useState(true)
  const [fintechApi, setFintechApi] = useState(null)
  const [subtotalThb, setSubtotalThb] = useState(10_000)
  const [guestServiceFeePercent, setGuestServiceFeePercent] = useState(15)
  const [referralReinvestmentPercent, setReferralReinvestmentPercent] = useState(45)
  const [totalBookingsPerMonth, setTotalBookingsPerMonth] = useState(200)
  const [referralSharePercent, setReferralSharePercent] = useState(80)
  const [turboBoostThbPerBooking, setTurboBoostThbPerBooking] = useState(0)
  const [promoTankThb, setPromoTankThb] = useState(0)
  const [hostActivationsPerMonth, setHostActivationsPerMonth] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const [fintechRes, settingsRes] = await Promise.all([fetchFintechSettings(), fetchAdminSettings()])
    if (fintechRes.ok && fintechRes.data?.settings) {
      setFintechApi(fintechRes.data.settings)
      const liveReinvest = Number(fintechRes.data.settings.referral_reinvestment_percent)
      if (Number.isFinite(liveReinvest)) {
        setReferralReinvestmentPercent(
          Math.min(LAUNCH_PLANNER_REINVESTMENT_MAX, Math.max(LAUNCH_PLANNER_REINVESTMENT_MIN, liveReinvest)),
        )
      }
    }
    if (settingsRes.ok && settingsRes.data) {
      const pot = Number(settingsRes.data.marketingPromoPot ?? settingsRes.data.marketing_promo_pot ?? 0)
      if (Number.isFinite(pot) && pot >= 0) setPromoTankThb(pot)
      const boost = Number(settingsRes.data.promoBoostPerBooking ?? settingsRes.data.promo_boost_per_booking ?? 0)
      if (Number.isFinite(boost) && boost >= 0) setTurboBoostThbPerBooking(boost)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const plan = useMemo(() => {
    if (!fintechApi) return null
    const referralBookingsPerMonth = Math.round((totalBookingsPerMonth * referralSharePercent) / 100)
    const inputs = normalizePlannerInputs({
      subtotalThb,
      guestServiceFeePercent,
      referralReinvestmentPercent,
      totalBookingsPerMonth,
      referralBookingsPerMonth,
      turboBoostThbPerBooking,
      promoTankThb,
      hostActivationsPerMonth,
    })
    const basePolicy = fintechSettingsToPolicy(fintechApi)
    return computeLaunchPromoPlan(basePolicy, inputs)
  }, [
    fintechApi,
    subtotalThb,
    guestServiceFeePercent,
    referralReinvestmentPercent,
    totalBookingsPerMonth,
    referralSharePercent,
    turboBoostThbPerBooking,
    promoTankThb,
    hostActivationsPerMonth,
  ])

  if (loading) {
    return (
      <Card>
        <CardContent className="py-16 flex items-center justify-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Загрузка SSOT FinTech…
        </CardContent>
      </Card>
    )
  }

  const pb = plan?.perBookingReferral
  const mo = plan?.monthly

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/marketing/budget"
            className="inline-flex min-h-[44px] items-center gap-1 text-sm text-slate-600 hover:text-brand"
          >
            <ArrowLeft className="h-4 w-4" />
            Бюджет и аудит
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-950 flex items-center gap-2">
            <Calculator className="h-7 w-7 text-brand" />
            Планировщик запуска
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            What-if калькулятор: эквайринг, налоги, резервы и referral pool — те же формулы, что при COMPLETED
            брони. Не меняет настройки в БД.
          </p>
        </div>
        <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => void load()}>
          Обновить SSOT
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_1fr]">
        <Card className="border-slate-200 h-fit xl:sticky xl:top-24">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Сценарий</CardTitle>
            <CardDescription>Подставьте ожидания по броням и акции.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Сумма брони (цена партнёра), THB</Label>
                <span className="text-sm font-semibold tabular-nums">{subtotalThb.toLocaleString('ru-RU')}</span>
              </div>
              <Slider
                min={LAUNCH_PLANNER_SUBTOTAL_MIN}
                max={LAUNCH_PLANNER_SUBTOTAL_MAX}
                step={500}
                value={[subtotalThb]}
                onValueChange={([v]) => setSubtotalThb(v)}
              />
              <div className="flex flex-wrap gap-2">
                {PRESET_CHECKS.map((v) => (
                  <Button
                    key={v}
                    type="button"
                    size="sm"
                    variant={subtotalThb === v ? 'default' : 'outline'}
                    className="min-h-[44px]"
                    onClick={() => setSubtotalThb(v)}
                  >
                    {v >= 1000 ? `${v / 1000}k` : v}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Доля чистой маржи в рефералку</Label>
                <span className="text-sm font-semibold tabular-nums">{referralReinvestmentPercent}%</span>
              </div>
              <Slider
                min={LAUNCH_PLANNER_REINVESTMENT_MIN}
                max={LAUNCH_PLANNER_REINVESTMENT_MAX}
                step={1}
                value={[referralReinvestmentPercent]}
                onValueChange={([v]) => setReferralReinvestmentPercent(v)}
              />
              <p className="text-[11px] text-slate-500">
                Диапазон {LAUNCH_PLANNER_REINVESTMENT_MIN}–{LAUNCH_PLANNER_REINVESTMENT_MAX}%. Live SSOT сейчас:{' '}
                {fintechApi?.referral_reinvestment_percent ?? '—'}%.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Guest fee %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={guestServiceFeePercent}
                  onChange={(e) => setGuestServiceFeePercent(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>Броней / мес (всего)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={totalBookingsPerMonth}
                  onChange={(e) => setTotalBookingsPerMonth(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Доля броней с рефералом</Label>
                <span className="text-sm font-semibold tabular-nums">{referralSharePercent}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[referralSharePercent]}
                onValueChange={([v]) => setReferralSharePercent(v)}
              />
              <p className="text-[11px] text-slate-500">
                ≈ {mo?.referralBookings ?? 0} реф. броней / {mo?.organicBookings ?? 0} без реферала
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Turbo +THB / реф-бронь</Label>
                <Input
                  type="number"
                  min={0}
                  step={10}
                  value={turboBoostThbPerBooking}
                  onChange={(e) => setTurboBoostThbPerBooking(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label>Promo tank, THB</Label>
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={promoTankThb}
                  onChange={(e) => setPromoTankThb(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Host activation / мес (новые партнёры)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={hostActivationsPerMonth}
                onChange={(e) => setHostActivationsPerMonth(Number(e.target.value))}
              />
              <p className="text-[11px] text-slate-500">
                {fmtThb(fintechApi?.partner_activation_bonus_thb ?? 500)} из promo tank за активацию (L1/L2).
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {plan?.warnings?.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 space-y-2">
              {plan.warnings.map((w) => (
                <p key={w} className="text-sm text-amber-950 flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                  {w}
                </p>
              ))}
            </div>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Одна реферальная бронь</CardTitle>
              <CardDescription>
                Gross {pb?.platformGrossThb ? fmtThb(pb.platformGrossThb) : '—'} → вычеты → net → pool{' '}
                {referralReinvestmentPercent}% → платформе остаётся.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pb ? (
                <>
                  <AmbassadorOwnerWaterfallBar
                    guestPaymentThb={pb.guestPaymentThb}
                    platformGrossThb={pb.platformGrossThb}
                    deductions={pb.deductions}
                    adjustedNetThb={pb.adjustedNetThb}
                    referralPoolThb={pb.referralPoolThb}
                    ownerRetainedThb={pb.ownerRetainedThb}
                    split={{
                      ...pb.split,
                      l2AmountThb: pb.split.l2AmountThb,
                      l3AmountThb: pb.split.l3AmountThb,
                    }}
                  />
                  {pb.split.l3AmountThb > 0 ? (
                    <p className="text-xs text-slate-500 flex items-center gap-1">
                      <Info className="h-3.5 w-3.5" />
                      L3 {fmtThb(pb.split.l3AmountThb)} — в ledger только при gate (≥10 партнёров + consent).
                    </p>
                  ) : null}
                </>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2">
                <MetricRow
                  label="Эквайринг"
                  value={fmtThb(pb?.deductions.acquiringFeeThb)}
                  hint={`SSOT ${fintechApi?.acquiring_fee_percent ?? '—'}% от оплаты гостя`}
                />
                <MetricRow label="УСН + НДС + резервы" value={fmtThb(
                  (pb?.deductions.usnProvisionThb ?? 0) +
                    (pb?.deductions.vatProvisionThb ?? 0) +
                    (pb?.deductions.reserveBankThb ?? 0) +
                    (pb?.deductions.insuranceReserveThb ?? 0),
                )} />
                <MetricRow label="Чистая маржа (adjusted net)" value={fmtThb(pb?.adjustedNetThb)} tone="good" />
                <MetricRow
                  label="Referral pool"
                  value={fmtThb(pb?.referralPoolThb)}
                  hint={`${referralReinvestmentPercent}% от net`}
                />
                <MetricRow
                  label="Платформе после рефералки"
                  value={fmtThb(pb?.ownerRetainedThb)}
                  hint={`${roundPct(pb?.ownerRetainedThb, pb?.adjustedNetThb)}% от net · ${roundPct(pb?.ownerRetainedThb, pb?.platformGrossThb)}% от gross`}
                  tone="good"
                />
                <MetricRow label="L1 / L2 / L3 / cashback" value={`${fmtThb(pb?.split.l1AmountThb)} / ${fmtThb(pb?.split.l2AmountThb)} / ${fmtThb(pb?.split.l3AmountThb)} / ${fmtThb(pb?.split.refereeAmountThb)}`} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Прогноз на месяц</CardTitle>
              <CardDescription>
                Pool идёт в program cap ({fmtThb(mo?.programCapThb)}). Turbo и host activation — из promo tank.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-slate-200 px-4 py-2">
                <MetricRow label="Gross комиссия (все брони)" value={fmtThb(mo?.grossCommissionThb)} />
                <MetricRow label="Referral pool (в cap)" value={fmtThb(mo?.poolSpendThb)} tone={mo?.capExceeded ? 'warn' : 'neutral'} />
                <MetricRow label="Turbo из tank" value={fmtThb(mo?.turboSpendThb)} />
                <MetricRow label="Host activation из tank" value={fmtThb(mo?.hostActivationSpendThb)} />
                <MetricRow
                  label="Итого promo tank"
                  value={fmtThb(mo?.promoTankUsedThb)}
                  hint={mo?.turboRunwayBookings != null ? `Turbo хватит ≈ на ${mo.turboRunwayBookings} броней` : null}
                />
                <MetricRow
                  label="Платформе (после pool, все брони)"
                  value={fmtThb(mo?.ownerRetainedThb)}
                  tone="good"
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="font-medium text-slate-800">Program cap (UTC месяц)</span>
                  <span className="tabular-nums font-semibold">
                    {fmtThb(mo?.poolSpendThb)} / {fmtThb(mo?.programCapThb)} ({mo?.capUtilizationPct}%)
                  </span>
                </div>
                <Progress
                  value={Math.min(100, mo?.capUtilizationPct ?? 0)}
                  className={cn('h-3', (mo?.capUtilizationPct ?? 0) >= 80 ? '[&>div]:bg-amber-500' : '[&>div]:bg-brand')}
                />
                {mo?.bookingsUntilCap != null && mo.bookingsUntilCap >= 0 ? (
                  <p className="text-xs text-slate-500">
                    До cap остаётся ≈ {mo.bookingsUntilCap} реф-броней при текущем чеке и {referralReinvestmentPercent}%.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-slate-500">
            Эквайринг, УСН, НДС и split L1/L2/L3 подтягиваются из{' '}
            <Link href="/admin/settings/finances" className="text-brand hover:underline">
              FinTech SSOT
            </Link>
            . Смена % в калькуляторе — только симуляция; сохранение политики — там же (Owner mode off).
          </p>
        </div>
      </div>
    </div>
  )
}

function roundPct(part, whole) {
  const p = Number(part)
  const w = Number(whole)
  if (!Number.isFinite(p) || !Number.isFinite(w) || w <= 0) return '—'
  return `${Math.round((p / w) * 1000) / 10}%`
}

export default LaunchPromoCalculatorPanel
