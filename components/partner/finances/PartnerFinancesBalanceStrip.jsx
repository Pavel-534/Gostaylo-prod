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

function buildBalanceItems(t, summary, thawHoldHint, escrowHint) {
  return [
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
}

function BalanceCompactStrip({ t, items, loading }) {
  const escrow = items.find((item) => item.id === 'escrow')
  const available = items.find((item) => item.id === 'available')
  const thaw = items.find((item) => item.id === 'thaw')
  const parts = []

  if (escrow) {
    parts.push(
      <span key="escrow" className="font-medium text-amber-800">
        {escrow.title}: {loading ? '—' : <PartnerHostLedgerAmount thb={escrow.value} />}
      </span>,
    )
  }
  if ((thaw?.value ?? 0) > 0) {
    parts.push(
      <span key="thaw" className="text-slate-700">
        {thaw.title}: {loading ? '—' : <PartnerHostLedgerAmount thb={thaw.value} />}
      </span>,
    )
  }
  if (available) {
    parts.push(
      <span key="available" className="font-semibold text-brand-hover">
        {available.title}: {loading ? '—' : <PartnerHostLedgerAmount thb={available.value} />}
      </span>,
    )
  }

  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm md:hidden">
      {parts.map((part, index) => (
        <span key={part.key} className="inline-flex flex-wrap items-center gap-2">
          {index > 0 ? (
            <span className="text-slate-300" aria-hidden>
              ·
            </span>
          ) : null}
          {part}
        </span>
      ))}
    </div>
  )
}

/**
 * Escrow / thaw / available / paid buckets — full grid on md+, compact strip on mobile (Stage 186.1).
 */
export function PartnerFinancesBalanceStrip({ t, summary, loading, thawHoldHint, escrowHint }) {
  const items = buildBalanceItems(t, summary, thawHoldHint, escrowHint)

  return (
    <div className="space-y-2">
      <BalanceCompactStrip t={t} items={items} loading={loading} />
      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {items.map(({ id, icon: Icon, title, hint, value, accent }) => (
          <div
            key={id}
            className={cn('rounded-xl border p-4 min-h-[6.5rem] flex flex-col', ACCENTS[accent])}
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
