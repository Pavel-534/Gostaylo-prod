'use client'

import { Shield, Clock, Wallet, Banknote } from 'lucide-react'
import { PartnerHostLedgerAmount, PartnerHostMidFxFootnote } from '@/components/partner/finances/partner-host-amount-display'
import { cn } from '@/lib/utils'

const ACCENTS = {
  escrow: 'border-amber-200 bg-amber-50/80',
  thaw: 'border-sky-200 bg-sky-50/80',
  available: 'border-brand/25 bg-brand/10',
  paid: 'border-slate-200 bg-slate-50/80',
}

/**
 * @param {object} props
 * @param {Function} t
 * @param {object} [summary]
 * @param {boolean} [loading]
 */
export function PartnerFinancesBalanceStrip({ t, summary, loading, thawHoldHint, escrowHint }) {
  const items = [
    {
      id: 'escrow',
      icon: Shield,
      title: t('partnerFinances_bucketEscrowTitle'),
      hint: escrowHint || t('partnerFinances_bucketEscrowDescShort'),
      value: summary?.escrowThb ?? 0,
      accent: 'escrow',
    },
    {
      id: 'thaw',
      icon: Clock,
      title: t('partnerFinances_bucketThawHoldTitle'),
      hint: thawHoldHint || t('partnerFinances_bucketThawHoldDescShort'),
      value: summary?.thawHoldThb ?? 0,
      accent: 'thaw',
    },
    {
      id: 'available',
      icon: Wallet,
      title: t('partnerFinances_bucketAvailableTitle'),
      hint: t('partnerFinances_bucketAvailableDescShort'),
      value: summary?.availableThb ?? 0,
      accent: 'available',
    },
    {
      id: 'paid',
      icon: Banknote,
      title: t('partnerFinances_bucketTotalPaidTitle'),
      hint: t('partnerFinances_bucketTotalPaidDescShort'),
      value: summary?.totalPaidThb ?? 0,
      accent: 'paid',
    },
  ]

  return (
    <div className="space-y-2">
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      {items.map(({ id, icon: Icon, title, hint, value, accent }) => (
        <div
          key={id}
          className={cn('rounded-xl border p-4 min-h-[7.5rem] flex flex-col', ACCENTS[accent])}
        >
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Icon className="h-4 w-4 shrink-0 opacity-80" />
            {title}
          </div>
          <p className="text-xs text-slate-600 mt-1 leading-snug flex-1">{hint}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2 tabular-nums">
            {loading ? '—' : <PartnerHostLedgerAmount thb={value} />}
          </p>
        </div>
      ))}
    </div>
    <PartnerHostMidFxFootnote t={t} />
    </div>
  )
}
