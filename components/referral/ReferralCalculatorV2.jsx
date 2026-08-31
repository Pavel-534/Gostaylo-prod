'use client'

/**
 * Stage 131.A5.B2 — Referral calculator v2 (Variant B).
 * Shared by cabinet hero and /about/referral. Formula SSOT stays in API service.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { convertAmountThbWithMap } from '@/lib/finance/currency-converter-shared'
import { formatNativeAmountInCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

/**
 * Marketing calculator amounts: whole units in display currency.
 * Do NOT use ledger nearest-100 RUB snap — it turns small per-order shares into ₽0.
 */
function formatCalcAmountFromThb(thb, currencyCode, rateMap, language) {
  const code = String(currencyCode || 'THB').toUpperCase()
  const thbN = Number(thb)
  if (!Number.isFinite(thbN) || thbN <= 0) return formatNativeAmountInCurrency(0, code, language)
  if (code === 'THB') return formatNativeAmountInCurrency(Math.round(thbN), code, language)
  const rates = rateMap && typeof rateMap === 'object' ? { THB: 1, ...rateMap } : { THB: 1 }
  const raw = convertAmountThbWithMap(thbN, code, rates)
  if (raw == null || !Number.isFinite(raw)) {
    // FX not ready — avoid fake ₽0 for a real THB amount.
    return formatNativeAmountInCurrency(Math.round(thbN), 'THB', language)
  }
  const rounded = Math.round(raw)
  // Tiny positive amounts must not collapse to zero in the marketing example.
  if (rounded === 0 && raw > 0) {
    return formatNativeAmountInCurrency(1, code, language)
  }
  return formatNativeAmountInCurrency(rounded, code, language)
}

const ACTIVITY_PRESETS = [
  { value: 0, label: '0%' },
  { value: 0.33, label: '33%' },
  { value: 0.66, label: '66%' },
  { value: 1, label: '100%' },
]

/** Floor for average-order slider (display currency from header). */
const CALC_AVG_MIN = 3500

/** Realistic mid-order demos per header currency (marketing calc only). */
const DEMO_AVG_BY_CURRENCY = Object.freeze({
  RUB: 35000,
  THB: 15000,
  USD: 1000,
  USDT: 1000,
  EUR: 900,
  GBP: 800,
  CNY: 7000,
})

function demoAvgForCurrency(currencyCode) {
  const code = String(currencyCode || 'THB').toUpperCase()
  const n = Number(DEMO_AVG_BY_CURRENCY[code])
  const demo = Number.isFinite(n) && n > 0 ? n : CALC_AVG_MIN
  return Math.max(demo, CALC_AVG_MIN)
}

function nearestActivityPreset(rate) {
  const n = Number(rate)
  if (!Number.isFinite(n)) return 0.33
  let best = ACTIVITY_PRESETS[1]
  let bestDiff = Infinity
  for (const p of ACTIVITY_PRESETS) {
    const d = Math.abs(p.value - n)
    if (d < bestDiff) {
      best = p
      bestDiff = d
    }
  }
  return best.value
}

function round2(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

/**
 * @param {{
 *   compact?: boolean,
 *   directPartnersInvited?: number | null,
 *   className?: string,
 * }} props
 */
export function ReferralCalculatorV2({
  compact = false,
  directPartnersInvited = null,
  className,
}) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const { convertDisplayToThb, currency: displayCurrency, rateMap } = useReferralLedgerDisplay()

  const formatMoney = useCallback(
    (thb) => formatCalcAmountFromThb(thb, displayCurrency, rateMap, language),
    [displayCurrency, rateMap, language],
  )

  // Realistic demo default: mid vacation/service order in the header currency.
  const [ordersArr, setOrdersArr] = useState([5])
  const [avgArr, setAvgArr] = useState([demoAvgForCurrency(displayCurrency)])
  const [activityRate, setActivityRate] = useState(0.33)
  const [mode, setMode] = useState('simple') // simple | detail | guest
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    setAvgArr([demoAvgForCurrency(displayCurrency)])
  }, [displayCurrency])

  const runCalc = useCallback(async () => {
    const orders = Math.max(1, Math.min(50, Number(ordersArr?.[0] ?? 5)))
    const avgDisplay = Number(avgArr?.[0] ?? 35000)
    if (!Number.isFinite(avgDisplay)) return

    const subtotalThb = Math.max(500, Math.round(convertDisplayToThb(avgDisplay) || 35000))
    const guestPaymentMode = displayCurrency === 'RUB' ? 'RUB_CROSS' : 'THB'
    const qs = new URLSearchParams({
      subtotalThb: String(subtotalThb),
      guestFeePercent: '15',
      guestPaymentMode,
      l1BookingsCount: String(orders),
      l2ConversionRate: String(activityRate),
    })

    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v2/referral/calculator?${qs.toString()}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok || json.success !== true) {
        setError(json.message || json.error || 'CALCULATOR_FAILED')
        setResult(null)
        return
      }
      setResult(json.data)
    } catch (e) {
      setError(e?.message || 'Network error')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [ordersArr, avgArr, activityRate, convertDisplayToThb, displayCurrency])

  useEffect(() => {
    const id = setTimeout(() => {
      void runCalc()
    }, 280)
    return () => clearTimeout(id)
  }, [runCalc])

  const l3Gate = Number(result?.l3MinDirectPartners ?? 10) || 10
  const partnersKnown = directPartnersInvited != null && Number.isFinite(Number(directPartnersInvited))
  const partnersCount = partnersKnown ? Math.max(0, Number(directPartnersInvited)) : null
  const l3LockedByPartners = partnersKnown ? partnersCount < l3Gate : false
  const l3LockedByFlag = result?.l3LiveEnabled === false
  const l3Locked = l3LockedByPartners || l3LockedByFlag || Number(result?.l3TotalThb || 0) <= 0

  const l1Total = Number(result?.l1TotalThb || 0)
  const l2Total = Number(result?.l2TotalThb || 0)
  const l3Total = l3Locked ? 0 : Number(result?.l3TotalThb || 0)
  const yourTotal = round2(l1Total + l2Total + l3Total)

  const split = result?.splitPercents || {}

  return (
    <Card className={cn('gsl-card', className)} data-testid="referral-calculator-v2">
      <CardContent className={cn('space-y-4', compact ? 'p-4' : 'p-5 sm:p-6')}>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{t('calc_simple_title')}</p>
          <p className="text-xs text-slate-500">{t('calc_simple_subtitle')}</p>
          <p className="text-[11px] leading-relaxed text-slate-500" data-testid="calc-currency-hint">
            {t('stage131a5_calcCurrencyHint')}
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-800">{t('calc_slider1_label')}</p>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{ordersArr?.[0] ?? 5}</p>
            </div>
            <Slider
              min={1}
              max={50}
              step={1}
              value={ordersArr}
              onValueChange={setOrdersArr}
              className="py-1"
              data-testid="calc-slider-orders"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-slate-800">
                {t('calc_slider2_label')} ({displayCurrency})
              </p>
              <p className="text-sm font-semibold tabular-nums text-slate-900">{avgArr?.[0] ?? 35000}</p>
            </div>
            <Slider
              min={CALC_AVG_MIN}
              max={500000}
              step={500}
              value={avgArr}
              onValueChange={(next) => {
                const raw = Number(next?.[0] ?? CALC_AVG_MIN)
                setAvgArr([Math.max(CALC_AVG_MIN, Number.isFinite(raw) ? raw : CALC_AVG_MIN)])
              }}
              className="py-1"
              data-testid="calc-slider-avg"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-800">{t('calc_slider3_label')}</p>
            <div className="grid grid-cols-4 gap-2" data-testid="calc-activity-presets">
              {ACTIVITY_PRESETS.map((p) => {
                const active = nearestActivityPreset(activityRate) === p.value
                return (
                  <button
                    key={p.label}
                    type="button"
                    className={cn(
                      'min-h-[44px] rounded-xl border text-sm font-semibold tabular-nums transition',
                      active
                        ? 'border-brand bg-brand text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-brand/40',
                    )}
                    onClick={() => setActivityRate(p.value)}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] leading-relaxed text-slate-500">{t('calc_slider3_help')}</p>
          </div>
        </div>

        {loading && !result ? (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('stage131a5_calcLoading')}
          </p>
        ) : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {result ? (
          <div
            className="rounded-2xl border border-brand/20 bg-brand/5 px-4 py-4 space-y-3"
            data-testid="calc-simple-result"
          >
            <p className="text-xs uppercase tracking-wide text-slate-600">{t('calc_result_title')}</p>
            <p className="text-3xl font-black tabular-nums text-brand break-words" data-testid="calc-total-amount">
              {formatMoney(yourTotal)}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
              <span>
                {t('calc_result_l1_label')}: {formatMoney(l1Total)}
              </span>
              <span>
                {t('calc_result_network_label')}: {formatMoney(l2Total)}
              </span>
            </div>

            {l3Locked ? (
              <div
                className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs text-slate-600"
                data-testid="calc-l3-locked"
              >
                <p className="font-semibold text-slate-800">{t('calc_l3_locked_title')}</p>
                <p className="mt-1">
                  {partnersKnown
                    ? t('calc_l3_locked_body', { X: String(partnersCount), count: String(partnersCount) })
                    : t('calc_l3_locked_public')}
                </p>
              </div>
            ) : (
              <p className="text-xs text-violet-800">
                {t('calc_result_l3_label')}: {formatMoney(l3Total)}
              </p>
            )}
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] flex-1"
            data-testid="calc-btn-how"
            onClick={() => setMode((m) => (m === 'detail' ? 'simple' : 'detail'))}
          >
            {mode === 'detail' ? t('calc_btn_close') : t('calc_btn_how')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-[44px] flex-1"
            data-testid="calc-btn-guest"
            onClick={() => setMode((m) => (m === 'guest' ? 'simple' : 'guest'))}
          >
            {mode === 'guest' ? t('calc_btn_close') : t('calc_btn_guest')}
          </Button>
        </div>

        {mode === 'detail' && result ? (
          <div
            className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4 text-sm"
            data-testid="calc-detail-panel"
          >
            <p className="font-semibold text-slate-900">{t('calc_detail_title')}</p>
            <ol className="space-y-3 text-slate-700">
              <li>
                {t('calc_step1', {
                  X: formatMoney(result.guestPaysTotalThb ?? result.guestPaymentThb),
                })}
                <span className="block text-xs text-slate-500 mt-0.5">{t('calc_step1_hint')}</span>
              </li>
              <li>
                {t('calc_step_pool', {
                  X: formatMoney(result.referralPoolThb),
                })}
                <span className="block text-xs text-slate-500 mt-0.5">{t('calc_step_pool_hint')}</span>
              </li>
              <li>
                <p>{t('calc_step4')}</p>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                  <li>
                    {t('calc_split_l1', {
                      pct: String(split.l1 ?? ''),
                      X: formatMoney(result.l1AmountThb),
                    })}
                  </li>
                  <li>
                    {t('calc_split_l2', {
                      pct: String(split.l2 ?? ''),
                      X: formatMoney(result.l2AmountThb),
                      capBooking: formatMoney(result.l2CapPerBookingThb ?? 500),
                      capMonth: formatMoney(result.l2CapPerMonthThb ?? 50_000),
                    })}
                  </li>
                  <li>
                    {l3Locked
                      ? partnersKnown
                        ? t('calc_split_l3_locked', {
                            pct: String(split.l3 ?? 5),
                            X: String(partnersCount),
                          })
                        : t('calc_split_l3_locked_public', { pct: String(split.l3 ?? 5) })
                      : t('calc_split_l3', {
                          pct: String(split.l3 ?? ''),
                          X: formatMoney(result.l3AmountThb),
                        })}
                  </li>
                  <li>
                    {t('calc_split_referee', {
                      pct: String(split.referee ?? ''),
                      X: formatMoney(result.refereeAmountThb),
                    })}
                  </li>
                </ul>
              </li>
            </ol>

            <div className="border-t border-slate-200 pt-3 space-y-1 text-xs text-slate-600">
              <p>
                {t('calc_total_l1', {
                  N: String(result.l1BookingsCount ?? ordersArr?.[0] ?? 5),
                  X: formatMoney(l1Total),
                })}
              </p>
              <p>
                {t('calc_total_l2', {
                  N: String(result.l1BookingsCount ?? ordersArr?.[0] ?? 5),
                  activity: String(Math.round(activityRate * 100)),
                  X: formatMoney(l2Total),
                })}
              </p>
              {!l3Locked ? (
                <p>
                  {t('calc_total_l3', {
                    N: String(result.l1BookingsCount ?? ordersArr?.[0] ?? 5),
                    activity: String(Math.round(activityRate * 100)),
                    X: formatMoney(l3Total),
                  })}
                </p>
              ) : null}
            </div>

            <p className="text-base font-bold text-slate-900">
              {t('calc_total_title', {
                X: formatMoney(yourTotal),
              })}
            </p>
          </div>
        ) : null}

        {mode === 'guest' && result ? (
          <div
            className="space-y-2 rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-4 text-sm"
            data-testid="calc-guest-panel"
          >
            <p className="font-semibold text-teal-950">{t('calc_guest_title')}</p>
            <p className="text-xs leading-relaxed text-teal-900/90">{t('calc_guest_body')}</p>
            <div className="rounded-xl border border-teal-200/80 bg-white/70 px-3 py-2.5 space-y-1 text-xs text-teal-950">
              <p>
                {t('calc_guest_example_order', {
                  X: formatMoney(result.subtotalThb ?? result.guestPaymentThb),
                })}
              </p>
              <p>
                {t('calc_guest_example_pool', {
                  pool: formatMoney(result.referralPoolThb),
                })}
              </p>
              <p className="font-semibold">
                {t('calc_guest_example_wallet', {
                  Y: formatMoney(result.refereeAmountThb),
                  pct: String(split.referee ?? ''),
                })}
              </p>
            </div>
            <p className="text-[11px] leading-relaxed text-teal-900/70">{t('calc_guest_footnote')}</p>
          </div>
        ) : null}

        <p className="text-[11px] leading-relaxed text-slate-500">{t('calc_disclaimer')}</p>
      </CardContent>
    </Card>
  )
}

export default ReferralCalculatorV2
