'use client'

import { Lock, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function formatThb(value, locale = 'ru-RU') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(locale, { maximumFractionDigits: 2 })
}

function formatUnlockDate(iso, locale) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Stage 121.2 — held referral balance (SSOT: referral/me + wallet/me).
 */
export function ReferralHeldBalanceStrip({ data, walletData, t, locale, className = '' }) {
  const heldFromReferral = Number(data?.stats?.heldReferralBalanceThb ?? 0)
  const heldFromWallet = Number(walletData?.balances?.heldReferralBalanceThb ?? 0)
  const heldThb = Math.max(heldFromReferral, heldFromWallet)
  const nearestUnlockAt = data?.stats?.nearestUnlockAt || null
  const holdDays = Number(data?.stats?.referralHoldDays ?? 0)

  if (!(heldThb > 0) && !nearestUnlockAt) return null

  const unlockLabel = formatUnlockDate(nearestUnlockAt, locale)
  const title = t?.('stage121_heldTitle') || 'В холде'
  const unlockText = unlockLabel
    ? (t?.('stage121_heldUnlockOn') || 'Ближайшая разблокировка: {date}').replace('{date}', unlockLabel)
    : null
  const hint =
    t?.('stage121_heldTooltip') ||
    'Бонусы начислены после завершённой поездки и станут доступны на кошельке после периода защиты от отмен и споров.'

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={`rounded-xl border border-amber-200/80 bg-gradient-to-br from-amber-50/90 via-white to-white px-4 py-3.5 shadow-sm ${className}`}
        role="status"
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-amber-100/80 p-2 shrink-0">
            <Lock className="h-5 w-5 text-amber-800" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-amber-950/90">{title}</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex text-amber-700/70 hover:text-amber-900"
                    aria-label={t?.('stage121_heldTooltipAria') || 'Пояснение про холд'}
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                  {hint}
                  {holdDays > 0 ? (
                    <p className="mt-1 text-[11px] opacity-90">
                      {(t?.('stage121_heldDaysPolicy') || 'Стандартный период: {days} дн.').replace(
                        '{days}',
                        String(holdDays),
                      )}
                    </p>
                  ) : null}
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-2xl font-black tabular-nums text-amber-950 tracking-tight">
              {formatThb(heldThb, locale)}{' '}
              <span className="text-sm font-semibold text-amber-900/80">THB</span>
            </p>
            {unlockText ? (
              <p className="text-xs text-amber-900/75 leading-snug">{unlockText}</p>
            ) : (
              <p className="text-xs text-amber-900/60">
                {t?.('stage121_heldPendingUnlock') || 'Разблокировка по расписанию платформы'}
              </p>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
