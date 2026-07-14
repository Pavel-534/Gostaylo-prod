'use client'

import { ChevronRight, Shield } from 'lucide-react'
import { getUIText } from '@/lib/translations'
import { usePartnerReputationHealthQuery } from '@/hooks/use-partner-reputation-health'
import { cn } from '@/lib/utils'

/**
 * Compact reputation summary — opens PartnerSuccessHelpDrawer (Stage 187.0).
 */
export function PartnerDashboardReputationChip({ language = 'ru', onOpen, className }) {
  const q = usePartnerReputationHealthQuery(true)
  const snap = q.data?.snapshot
  const pct = snap?.reliabilityPercent
  const tier = String(snap?.tier || 'NEW').toUpperCase()

  const label =
    q.isPending || q.isError
      ? getUIText('partnerDashboard_reputationChipLoading', language)
      : getUIText('partnerDashboard_reputationChip', language)
          .replace('{percent}', pct != null && Number.isFinite(pct) ? String(Math.round(pct)) : '—')
          .replace('{tier}', tier)

  return (
    <button
      type="button"
      onClick={() => onOpen?.()}
      disabled={q.isPending}
      className={cn(
        'flex w-full min-h-[44px] items-center justify-between gap-3 rounded-2xl border border-brand/25 bg-brand/5 px-4 py-3 text-left',
        'transition-colors hover:bg-brand/10 active:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
        className,
      )}
      aria-label={getUIText('partnerDashboard_reputationChipAria', language)}
    >
      <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-900">
        <Shield className="h-4 w-4 shrink-0 text-brand" aria-hidden />
        <span className="truncate tabular-nums">{label}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-brand" aria-hidden />
    </button>
  )
}
