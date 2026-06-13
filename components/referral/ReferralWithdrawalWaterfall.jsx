'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  Banknote,
  Info,
  Loader2,
  Minus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/contexts/i18n-context'
import { getUIText } from '@/lib/translations'
import { ReferralRuPayoutProfileForm } from '@/components/referral/ReferralRuPayoutProfileForm'
import { ReferralPayoutBlockers } from '@/components/referral/ReferralPayoutBlockers'

function fmtThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

function fmtRub(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 0 })
}

function WaterfallStep({ label, amount, sublabel, tone = 'neutral', icon: Icon }) {
  const tones = {
    neutral: 'border-slate-200 bg-white text-slate-900',
    fee: 'border-amber-200/90 bg-amber-50/60 text-amber-950',
    net: 'border-emerald-200/90 bg-emerald-50/70 text-emerald-950',
    brand: 'border-brand/25 bg-brand/5 text-brand',
  }
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone] || tones.neutral}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide opacity-70">
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
            {label}
          </div>
          <p className="mt-1 text-xl sm:text-2xl font-bold tabular-nums tracking-tight">{amount}</p>
          {sublabel ? <p className="mt-1 text-xs opacity-80 leading-relaxed">{sublabel}</p> : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Stage 131.5 / 132.2 — RUB-only withdrawal waterfall (Value Lock THB → Net RUB @ mid).
 */
export function ReferralWithdrawalWaterfall({
  maxWithdrawableThb = 0,
  minPayoutThb = 1000,
  payoutEligible = false,
  referralWithdrawRequested = false,
  withdrawRequesting = false,
  onRequestWithdraw,
  blockerDetails = [],
  locale = 'ru-RU',
  className = '',
}) {
  const { language } = useI18n()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])
  const maxGross = Math.max(0, Number(maxWithdrawableThb) || 0)
  const [amountInput, setAmountInput] = useState('')
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ruProfileReady, setRuProfileReady] = useState(false)

  const fmtMin = useMemo(
    () =>
      Number(minPayoutThb).toLocaleString(locale, { maximumFractionDigits: 0 }),
    [minPayoutThb, locale],
  )

  useEffect(() => {
    if (maxGross > 0 && !amountInput) {
      setAmountInput(String(Math.floor(maxGross)))
    }
  }, [maxGross, amountInput])

  const grossThb = useMemo(() => {
    const raw = Number(String(amountInput || '').replace(/\s/g, '').replace(',', '.'))
    if (!Number.isFinite(raw) || raw <= 0) return 0
    return Math.min(maxGross, Math.round(raw * 100) / 100)
  }, [amountInput, maxGross])

  const fetchPreview = useCallback(async () => {
    if (!payoutEligible || !ruProfileReady || referralWithdrawRequested || grossThb <= 0) {
      setPreview(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({
        payoutCurrency: 'RUB',
        grossThb: String(grossThb),
      })
      const res = await fetch(`/api/v2/wallet/referral-withdrawal-preview?${qs}`, {
        credentials: 'include',
        cache: 'no-store',
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json?.success) {
        setError(json?.error || t('stage1322_waterfallPreviewErr'))
        setPreview(null)
      } else {
        setPreview(json.data)
      }
    } catch (e) {
      setError(e?.message || t('stage1322_waterfallNetworkErr'))
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [payoutEligible, ruProfileReady, referralWithdrawRequested, grossThb, t])

  useEffect(() => {
    const timer = setTimeout(() => void fetchPreview(), 280)
    return () => clearTimeout(timer)
  }, [fetchPreview])

  const belowMin = grossThb > 0 && grossThb < minPayoutThb
  const canSubmit =
    payoutEligible &&
    ruProfileReady &&
    !referralWithdrawRequested &&
    !belowMin &&
    grossThb > 0 &&
    !loading

  if (maxGross <= 0 && !referralWithdrawRequested) return null

  const feePercent = preview?.withdrawalFeePercent ?? 1.5

  return (
    <div
      className={`rounded-2xl border border-slate-200/90 bg-gradient-to-b from-white via-slate-50/40 to-white p-5 sm:p-6 shadow-sm space-y-5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand/10 p-2.5 shrink-0">
          <ShieldCheck className="h-5 w-5 text-brand" aria-hidden />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900 tracking-tight">{t('stage1322_waterfallTitle')}</h3>
          <p className="text-sm text-slate-600 mt-0.5">{t('stage1322_waterfallSubtitle')}</p>
        </div>
      </div>

      {!payoutEligible && !referralWithdrawRequested && blockerDetails?.length ? (
        <ReferralPayoutBlockers blockerDetails={blockerDetails} compact />
      ) : null}

      <ReferralRuPayoutProfileForm onReady={setRuProfileReady} />

      <div className="space-y-2">
        <Label htmlFor="withdraw-gross-thb">{t('stage1322_waterfallAmountLabel')}</Label>
        <div className="flex gap-2">
          <Input
            id="withdraw-gross-thb"
            type="number"
            min={0}
            max={maxGross}
            step={1}
            value={amountInput}
            disabled={!payoutEligible || referralWithdrawRequested || !ruProfileReady}
            onChange={(e) => setAmountInput(e.target.value)}
            className="tabular-nums"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={!payoutEligible || referralWithdrawRequested || !ruProfileReady}
            onClick={() => setAmountInput(String(Math.floor(maxGross)))}
          >
            {t('stage1322_waterfallMaxBtn')}
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          {t('stage1322_waterfallAvailable', { amount: fmtThb(maxGross, locale) })}
          {minPayoutThb > 0 ? t('stage1322_waterfallMinNote', { minThb: fmtMin }) : null}
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('stage1322_waterfallRecalc')}
        </div>
      ) : preview ? (
        <div className="space-y-2">
          <WaterfallStep
            label={t('stage1322_waterfallGrossLabel')}
            amount={`${fmtThb(preview.grossThb, locale)} THB`}
            tone="brand"
            icon={Sparkles}
          />
          <div className="flex justify-center py-0.5 text-slate-300" aria-hidden>
            <ArrowDown className="h-4 w-4" />
          </div>
          <WaterfallStep
            label={t('stage1322_waterfallFeeLabel', { feePercent })}
            amount={`−${fmtThb(preview.withdrawalFeeThb, locale)} THB`}
            sublabel={t('stage1322_waterfallFeeSublabel')}
            tone="fee"
            icon={Minus}
          />
          <div className="flex justify-center py-0.5 text-slate-300" aria-hidden>
            <ArrowDown className="h-4 w-4" />
          </div>
          <WaterfallStep
            label={t('stage1322_waterfallNetLabel')}
            amount={
              preview.netInPayoutCurrency != null
                ? `≈ ${fmtRub(preview.netInPayoutCurrency, locale)} ₽`
                : `${fmtThb(preview.netThb, locale)} THB`
            }
            sublabel={t('stage1322_waterfallNetSublabel', { netThb: fmtThb(preview.netThb, locale) })}
            tone="net"
            icon={Banknote}
          />
          <div className="rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm text-brand-hover leading-relaxed">
            <p className="font-semibold text-brand">{t('stage1322_waterfallRubOnlyTitle')}</p>
            <p className="mt-1 text-brand/80">
              {t('stage1322_waterfallRubOnlyBody', { feePercent })}
            </p>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {belowMin ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-3 py-2">
          {t('stage1322_waterfallBelowMin', { minThb: fmtMin })}
        </p>
      ) : null}

      {preview?.disclaimer ? (
        <div className="flex gap-2 text-xs text-slate-500 leading-relaxed">
          <Info className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" aria-hidden />
          <p>{preview.disclaimer}</p>
        </div>
      ) : null}

      {onRequestWithdraw ? (
        <Button
          variant="brand"
          size="lg"
          className="w-full sm:w-auto min-h-11"
          disabled={!canSubmit || withdrawRequesting}
          onClick={() => onRequestWithdraw()}
        >
          {referralWithdrawRequested
            ? t('stage1322_waterfallSubmitRequested')
            : withdrawRequesting
              ? t('stage1322_waterfallSubmitSending')
              : !ruProfileReady
                ? t('stage1322_waterfallSubmitNeedProfile')
                : t('stage1322_waterfallSubmitConfirm')}
        </Button>
      ) : null}
    </div>
  )
}

export default ReferralWithdrawalWaterfall
