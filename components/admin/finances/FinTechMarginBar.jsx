'use client'

import { ArrowRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmtThb(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '0'
  return x.toLocaleString('ru-RU', { maximumFractionDigits: 0 })
}

function StepBox({ label, amount, tone = 'neutral', className }) {
  const tones = {
    neutral: 'border-slate-200 bg-white text-slate-800',
    in: 'border-indigo-200 bg-indigo-50/60 text-indigo-950',
    out: 'border-slate-300 bg-slate-100 text-slate-700',
    loss: 'border-rose-200 bg-rose-50/80 text-rose-800',
    gain: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    deficit: 'border-rose-400 bg-rose-100 text-rose-900',
  }
  return (
    <div
      className={cn(
        'flex min-w-[120px] flex-1 flex-col rounded-xl border px-3 py-2.5 shadow-sm',
        tones[tone] || tones.neutral,
        className,
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-70">{label}</span>
      <span className="mt-1 text-lg font-bold tabular-nums">฿{fmtThb(amount)}</span>
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="hidden shrink-0 items-center justify-center text-slate-300 sm:flex" aria-hidden>
      <ArrowRight className="h-4 w-4" />
    </div>
  )
}

function FlowMinus() {
  return (
    <div className="flex shrink-0 items-center justify-center text-slate-400" aria-hidden>
      <Minus className="h-4 w-4" />
    </div>
  )
}

/**
 * Referral margin waterfall (Stage 120.6): commission → bonuses → clawback → net.
 */
export function ReferralMarginWaterfall({ commissionThb, bonusesThb, clawbackThb, netMarginThb, className }) {
  const commission = Math.max(0, Number(commissionThb) || 0)
  const bonuses = Math.max(0, Number(bonusesThb) || 0)
  const clawback = Math.max(0, Number(clawbackThb) || 0)
  const net = Number(netMarginThb)
  const netSafe = Number.isFinite(net) ? net : commission - bonuses - clawback
  const netTone = netSafe >= 0 ? 'gain' : 'deficit'

  if (commission <= 0 && bonuses <= 0) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500',
          className,
        )}
      >
        Нет комиссии за период — водопад появится после оплаченных броней реферальной воронки.
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-1">
        <StepBox label="Комиссия платформы" amount={commission} tone="in" />
        <FlowArrow />
        <div className="flex flex-col gap-2 sm:flex-1 sm:flex-row sm:items-stretch">
          <StepBox label="Promo tank (бонусы)" amount={bonuses} tone="out" />
          <FlowMinus />
          <StepBox label="Clawback / возвраты" amount={clawback} tone="loss" />
        </div>
        <FlowArrow />
        <StepBox label="Net-маржа" amount={netSafe} tone={netTone} />
      </div>
      <p className="text-center text-xs text-slate-500 sm:text-left">
        Формула:{' '}
        <span className="font-mono text-slate-600">
          net = комиссия − бонусы − clawback
        </span>
        {' · '}
        gross = комиссия − бонусы
      </p>
    </div>
  )
}

/**
 * Stage 131.0 — Ambassador owner waterfall (admin-only; includes owner retained).
 */
export function AmbassadorOwnerWaterfallBar({
  guestPaymentThb,
  platformGrossThb,
  deductions = {},
  adjustedNetThb,
  referralPoolThb,
  ownerRetainedThb,
  split = {},
  className,
}) {
  const gross = Math.max(0, Number(platformGrossThb) || 0)
  const guestPay = Math.max(0, Number(guestPaymentThb) || 0)
  const acq = Math.max(0, Number(deductions.acquiringFeeThb) || 0)
  const usn = Math.max(0, Number(deductions.usnProvisionThb) || 0)
  const vat = Math.max(0, Number(deductions.vatProvisionThb) || 0)
  const bank = Math.max(0, Number(deductions.reserveBankThb) || 0)
  const ops = Math.max(0, Number(deductions.operationalReserveThb) || 0)
  const ins = Math.max(0, Number(deductions.insuranceReserveThb) || 0)
  const deductionsTotal = acq + usn + vat + bank + ops + ins
  const adjusted = Number.isFinite(Number(adjustedNetThb))
    ? Number(adjustedNetThb)
    : Math.max(0, gross - deductionsTotal)
  const pool = Math.max(0, Number(referralPoolThb) || 0)
  const retained = Math.max(0, Number(ownerRetainedThb) || Math.max(0, adjusted - pool))

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-stretch lg:flex-wrap">
        <StepBox label="Guest payment" amount={guestPay} tone="in" />
        <FlowArrow />
        <StepBox label="Platform gross" amount={gross} tone="in" />
        <FlowMinus />
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:flex-1">
          <StepBox label="Acquiring" amount={acq} tone="loss" className="min-w-[100px]" />
          <StepBox label="УСН" amount={usn} tone="out" className="min-w-[90px]" />
          <StepBox label="НДС" amount={vat} tone="out" className="min-w-[90px]" />
          <StepBox label="Банк" amount={bank} tone="out" className="min-w-[90px]" />
          {ins > 0 ? <StepBox label="Insurance" amount={ins} tone="out" className="min-w-[90px]" /> : null}
          {ops > 0 ? <StepBox label="Ops reserve" amount={ops} tone="out" className="min-w-[90px]" /> : null}
        </div>
        <FlowArrow />
        <StepBox label="Adjusted net" amount={adjusted} tone="gain" />
        <FlowMinus />
        <StepBox label="Referral pool" amount={pool} tone="in" />
        <FlowArrow />
        <StepBox label="Owner retained" amount={retained} tone="gain" />
      </div>
      {pool > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <StepBox label="L1" amount={split.l1AmountThb} tone="in" className="max-w-[140px]" />
          {(Number(split.l2AmountThb) || 0) > 0 ? (
            <StepBox label="L2" amount={split.l2AmountThb} tone="in" className="max-w-[140px]" />
          ) : null}
          <StepBox label="Guest cashback" amount={split.refereeAmountThb} tone="in" className="max-w-[160px]" />
        </div>
      ) : null}
    </div>
  )
}

/**
 * Visual margin waterfall: accepted → payouts + losses → net (FinTech-пульт).
 */
export function FinTechMarginBar({ acceptedThb, paidOutThb, lossesThb, netMarginThb, className, variant = 'default' }) {
  if (variant === 'referral') {
    return (
      <ReferralMarginWaterfall
        commissionThb={acceptedThb}
        bonusesThb={paidOutThb}
        clawbackThb={lossesThb}
        netMarginThb={netMarginThb}
        className={className}
      />
    )
  }

  const accepted = Math.max(0, Number(acceptedThb) || 0)
  const paid = Math.max(0, Number(paidOutThb) || 0)
  const losses = Math.max(0, Number(lossesThb) || 0)
  const net = Number(netMarginThb)
  const netSafe = Number.isFinite(net) ? net : accepted - paid - losses

  if (accepted <= 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500',
          className,
        )}
      >
        Нет поступлений за период — маржа появится после оплат гостей.
      </div>
    )
  }

  const paidPct = Math.min(100, (paid / accepted) * 100)
  const lossPct = Math.min(100 - paidPct, (losses / accepted) * 100)
  const netPct = Math.max(0, 100 - paidPct - lossPct)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex h-10 w-full overflow-hidden rounded-lg border border-slate-200 shadow-inner">
        {paidPct > 0.5 ? (
          <div
            className="bg-slate-400 flex items-center justify-center text-[10px] font-medium text-white px-1"
            style={{ width: `${paidPct}%` }}
            title={`Выплаты: ฿${fmtThb(paid)}`}
          >
            {paidPct > 12 ? 'Выплаты' : ''}
          </div>
        ) : null}
        {lossPct > 0.5 ? (
          <div
            className="bg-rose-500 flex items-center justify-center text-[10px] font-medium text-white px-1"
            style={{ width: `${lossPct}%` }}
            title={`Потери FX: ฿${fmtThb(losses)}`}
          >
            {lossPct > 12 ? 'Потери' : ''}
          </div>
        ) : null}
        {netPct > 0.5 ? (
          <div
            className={cn(
              'flex items-center justify-center text-[10px] font-medium text-white px-1',
              netSafe >= 0 ? 'bg-emerald-600' : 'bg-red-600',
            )}
            style={{ width: `${netPct}%` }}
            title={`Чистая маржа: ฿${fmtThb(netSafe)}`}
          >
            {netPct > 12 ? 'Маржа' : ''}
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-400 shrink-0" />
          Выплаты ฿{fmtThb(paid)}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-rose-500 shrink-0" />
          Потери ฿{fmtThb(losses)}
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-sm shrink-0',
              netSafe >= 0 ? 'bg-emerald-600' : 'bg-red-600',
            )}
          />
          Чистая ฿{fmtThb(netSafe)}
        </div>
      </div>
    </div>
  )
}
