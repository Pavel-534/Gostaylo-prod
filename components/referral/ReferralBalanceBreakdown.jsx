'use client'

import { useMemo } from 'react'
import {
  Banknote,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  PiggyBank,
  ShieldAlert,
} from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { useI18n } from '@/contexts/i18n-context'
import { useReferralLedgerDisplay } from '@/lib/hooks/use-referral-ledger-display'
import { getUIText } from '@/lib/translations'
import { estimateLifetimeReferralPaidOutThb } from '@/lib/referral/estimate-lifetime-paid-out-thb'

function formatUnlockDate(iso, locale) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

function BalanceHintPopover({ tooltip, ariaLabel }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-600 shrink-0 min-h-[44px] min-w-[44px] inline-flex items-center justify-center md:min-h-0 md:min-w-0"
          aria-label={ariaLabel}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="max-w-xs text-left text-xs leading-snug">
        {tooltip}
      </PopoverContent>
    </Popover>
  )
}

function FxAmount({ thbAmount, formatAmount, className }) {
  return <span className={className}>{formatAmount(thbAmount)}</span>
}

function MidFxFootnote({ t }) {
  return (
    <p className="text-[10px] text-slate-500 flex items-center gap-1 leading-snug pt-0.5">
      <span>{t('stage1797_midFxHint')}</span>
      <BalanceHintPopover tooltip={t('stage1797_midFxTooltip')} ariaLabel={t('stage1797_midFxAria')} />
    </p>
  )
}

/**
 * Stage 132.0 / 179.7 / 192.0 — Ambassador balance triad (Available / 14-day hold / Paid out).
 *
 * @param {{
 *   walletData?: object | null,
 *   referralData?: object | null,
 *   locale?: string,
 *   variant?: 'full' | 'compact' | 'header',
 *   className?: string,
 * }} props
 */
export function ReferralBalanceBreakdown({
  walletData = null,
  referralData = null,
  locale = 'ru-RU',
  variant = 'full',
  className = '',
}) {
  const { language } = useI18n()
  const { isConvertedDisplay, formatThbAsDisplay: formatAmount } = useReferralLedgerDisplay()
  const t = useMemo(() => (key, ctx) => getUIText(key, language, ctx), [language])

  const amounts = useMemo(() => {
    const balances = walletData?.balances || {}
    const wallet = walletData?.wallet || {}

    const totalBalanceThb = Number(balances.totalBalanceThb ?? wallet.balance_thb ?? 0)
    const withdrawableBalanceThb = Number(
      balances.withdrawableBalanceThb ?? wallet.withdrawable_balance_thb ?? 0,
    )
    const internalCreditsThb = Number(balances.internalCreditsThb ?? wallet.internal_credits_thb ?? 0)
    const heldReferralBalanceThb = Number(
      balances.heldReferralBalanceThb ??
        referralData?.stats?.heldReferralBalanceThb ??
        wallet.held_referral_balance_thb ??
        0,
    )
    const securityHeldReferralBalanceThb = Number(balances.securityHeldReferralBalanceThb ?? 0)
    const nearestUnlockAt = referralData?.stats?.nearestUnlockAt || null
    const paidOutLifetimeThb = estimateLifetimeReferralPaidOutThb(walletData)

    return {
      totalBalanceThb,
      withdrawableBalanceThb,
      internalCreditsThb,
      heldReferralBalanceThb,
      securityHeldReferralBalanceThb,
      paidOutLifetimeThb,
      nearestUnlockAt,
      unlockLabel: formatUnlockDate(nearestUnlockAt, locale),
    }
  }, [walletData, referralData, locale])

  const triadRows = useMemo(() => {
    /** @type {Array<{ id: string, label: string, amountThb: number, sublabel?: string | null, hint?: string, icon: import('lucide-react').LucideIcon, tone: string, tooltip: string }>} */
    return [
      {
        id: 'withdrawable',
        label: t('stage1321_balanceWithdrawable'),
        amountThb: amounts.withdrawableBalanceThb,
        icon: Banknote,
        tone: 'emerald',
        tooltip: t('stage1321_balanceWithdrawableTooltip'),
      },
      {
        id: 'period-hold',
        label: t('stage1321_balancePeriodHoldLabel'),
        amountThb: amounts.heldReferralBalanceThb,
        sublabel: amounts.unlockLabel
          ? t('stage1321_balancePeriodHoldSublabel', { date: amounts.unlockLabel })
          : null,
        hint: t('stage1321_balancePeriodHoldHint'),
        icon: Lock,
        tone: 'amber',
        tooltip: t('stage1321_balancePeriodHoldTooltip'),
      },
      {
        id: 'paid-out',
        label: t('stage1321_balancePaidOut'),
        amountThb: amounts.paidOutLifetimeThb,
        sublabel: t('stage1321_balancePaidOutSublabel'),
        icon: CheckCircle2,
        tone: 'slate',
        tooltip: t('stage1321_balancePaidOutTooltip'),
      },
    ]
  }, [amounts, t])

  const extraRows = useMemo(() => {
    /** @type {Array<{ id: string, label: string, amountThb: number, sublabel?: string, icon: import('lucide-react').LucideIcon, tone: string, tooltip: string, always?: boolean }>} */
    const list = []
    if (variant !== 'header') {
      list.push({
        id: 'internal',
        label: t('stage1321_balanceInternal'),
        amountThb: amounts.internalCreditsThb,
        icon: PiggyBank,
        tone: 'slate',
        tooltip: t('stage1321_balanceInternalTooltip'),
        always: true,
      })
    }
    if (amounts.securityHeldReferralBalanceThb > 0) {
      list.push({
        id: 'security-hold',
        label: t('stage1321_balanceSecurityHold'),
        amountThb: amounts.securityHeldReferralBalanceThb,
        sublabel: t('stage1321_balanceSecurityHoldSublabel'),
        icon: ShieldAlert,
        tone: 'rose',
        tooltip: t('stage1321_balanceSecurityHoldTooltip'),
      })
    }
    return list.filter((r) => r.always || r.amountThb > 0)
  }, [amounts, variant, t])

  if (variant === 'header') {
    const heldTotal = amounts.heldReferralBalanceThb + amounts.securityHeldReferralBalanceThb
    if (!(heldTotal > 0)) return null
    return (
      <div className={cn('space-y-1.5 pt-1 border-t border-slate-100 text-sm', className)}>
        {amounts.heldReferralBalanceThb > 0 ? (
          <div className="flex items-center justify-between gap-2 text-amber-800">
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('stage1321_balanceHeldShort')}
            </span>
            <span className="tabular-nums font-medium">
              <FxAmount thbAmount={amounts.heldReferralBalanceThb} formatAmount={formatAmount} />
            </span>
          </div>
        ) : null}
        {amounts.securityHeldReferralBalanceThb > 0 ? (
          <div className="flex items-center justify-between gap-2 text-rose-800">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('stage1321_balanceSecurityShort')}
            </span>
            <span className="tabular-nums font-medium">
              <FxAmount
                thbAmount={amounts.securityHeldReferralBalanceThb}
                formatAmount={formatAmount}
              />
            </span>
          </div>
        ) : null}
      </div>
    )
  }

  const toneClasses = {
    brand: 'border-brand/20 bg-brand/5',
    emerald: 'border-emerald-200/90 bg-emerald-50/50',
    slate: 'border-slate-200 bg-slate-50/80',
    amber: 'border-amber-200/90 bg-amber-50/60',
    rose: 'border-rose-300/90 bg-rose-50/70 ring-1 ring-rose-200/50',
  }

  const textTone = {
    brand: 'text-brand',
    emerald: 'text-emerald-950',
    slate: 'text-slate-900',
    amber: 'text-amber-950',
    rose: 'text-rose-950',
  }

  if (variant === 'compact') {
    return (
      <div className={cn('rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3', className)}>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-slate-900">{t('stage1321_balanceBreakdownTitle')}</p>
          {isConvertedDisplay ? <MidFxFootnote t={t} /> : null}
        </div>
        <div className="space-y-2">
          {[...triadRows, ...extraRows].map((row) => {
            const Icon = row.icon
            return (
              <div
                key={row.id}
                className={cn(
                  'rounded-lg border px-3 py-2.5 space-y-1',
                  toneClasses[row.tone] || toneClasses.slate,
                  row.id === 'security-hold' && 'shadow-sm',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0">
                    <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', textTone[row.tone])} aria-hidden />
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-snug text-slate-800">{row.label}</p>
                      {row.sublabel ? (
                        <p className="text-[10px] text-slate-500 mt-0.5">{row.sublabel}</p>
                      ) : null}
                    </div>
                    <BalanceHintPopover tooltip={row.tooltip} ariaLabel={t('stage1321_tooltipAria')} />
                  </div>
                  <p className={cn('text-sm font-bold tabular-nums shrink-0', textTone[row.tone])}>
                    <FxAmount thbAmount={row.amountThb} formatAmount={formatAmount} />
                  </p>
                </div>
                {row.hint ? (
                  <p className="text-[10px] leading-snug text-slate-600 pl-6">{row.hint}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', className)} data-testid="referral-balance-triad">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-sm font-semibold text-slate-900">{t('stage1321_balanceBreakdownTitle')}</p>
        {isConvertedDisplay ? <MidFxFootnote t={t} /> : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {triadRows.map((row) => {
          const Icon = row.icon
          return (
            <div
              key={row.id}
              className={cn(
                'rounded-xl border p-4 transition-shadow hover:shadow-sm flex flex-col',
                toneClasses[row.tone] || toneClasses.slate,
              )}
              data-testid={`referral-balance-${row.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn('h-4 w-4 shrink-0', textTone[row.tone])} aria-hidden />
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-600 leading-snug">
                    {row.label}
                  </p>
                </div>
                <BalanceHintPopover tooltip={row.tooltip} ariaLabel={t('stage1321_tooltipAria')} />
              </div>
              <p className={cn('mt-2 text-2xl sm:text-3xl font-black tabular-nums tracking-tight', textTone[row.tone])}>
                <FxAmount thbAmount={row.amountThb} formatAmount={formatAmount} />
              </p>
              {row.sublabel ? (
                <p className="mt-1.5 text-[11px] text-slate-600 leading-snug flex items-center gap-1">
                  {row.id === 'period-hold' ? <Clock className="h-3 w-3 shrink-0" aria-hidden /> : null}
                  {row.sublabel}
                </p>
              ) : null}
              {row.hint ? (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-600 border-t border-black/5 pt-2">
                  {row.hint}
                </p>
              ) : null}
            </div>
          )
        })}
      </div>
      {extraRows.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {extraRows.map((row) => {
            const Icon = row.icon
            return (
              <div
                key={row.id}
                className={cn(
                  'rounded-xl border p-4',
                  toneClasses[row.tone] || toneClasses.slate,
                  row.id === 'security-hold' && 'shadow-md',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className={cn('h-4 w-4 shrink-0', textTone[row.tone])} aria-hidden />
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-600 leading-snug">
                      {row.label}
                    </p>
                  </div>
                  <BalanceHintPopover tooltip={row.tooltip} ariaLabel={t('stage1321_tooltipAria')} />
                </div>
                <p className={cn('mt-2 text-xl font-bold tabular-nums', textTone[row.tone])}>
                  <FxAmount thbAmount={row.amountThb} formatAmount={formatAmount} />
                </p>
                {row.sublabel ? (
                  <p className="mt-1 text-[11px] text-slate-600 leading-snug">{row.sublabel}</p>
                ) : null}
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default ReferralBalanceBreakdown
